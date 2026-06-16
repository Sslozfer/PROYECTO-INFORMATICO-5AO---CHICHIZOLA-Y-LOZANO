import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudFlag } from './fraud-flag.entity';
import { Rating } from '../ratings/ratings.entity';

// ─── Umbrales configurables ───────────────────────────────────────────────────
const ANOMALY_VARIANCE_THRESHOLD  = 0.5;   // varianza muy baja → votos en bloque
const ANOMALY_SPEED_MS            = 30_000; // < 30s entre votos → sospechoso
const ANOMALY_MIN_RATINGS         = 5;      // mínimo de ratings para activar
const ANOMALY_SCORE_THRESHOLD     = 5;      // puntaje acumulado para generar flag

const MUTUAL_UNKNOWN_WINDOW_MS    = 5 * 60_000;  // 5 min para recíproco desconocidos
const MUTUAL_PEER_WINDOW_MS       = 60 * 60_000; // 1h para recíproco entre pares
const MUTUAL_PEER_OUTLIER_GAP     = 0.4;          // 40% de diferencia sobre consenso → outlier

const RING_MAX_DEPTH              = 5;   // máximo de nodos a explorar en detección de ring
const RING_WINDOW_DAYS            = 7;   // solo ratings de los últimos 7 días

const SOURCE_BIAS_MIN_DIVERGENCE  = 0.35; // 35% de divergencia entre fuentes → flag

export interface FraudCheckResult {
  flags:         Partial<FraudFlag>[];
  totalSeverity: number;
}

@Injectable()
export class FraudService {
  constructor(
    @InjectRepository(FraudFlag)
    private fraudFlagRepo: Repository<FraudFlag>,

    @InjectRepository(Rating)
    private ratingRepo: Repository<Rating>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // PUNTO DE ENTRADA PRINCIPAL
  // Corre todos los checks y devuelve flags + severidad total.
  // ─────────────────────────────────────────────────────────────────────────────

  async runChecks(params: {
    savedRating:        Rating;
    recentRatings:      Rating[];   // últimos 50 votos del emisor
    reverseRating:      Rating | null;
    fromUser:           { id: number; company_id: number | null };
    toUser:             { id: number; company_id: number | null };
    weightedConsensus:  number;     // consenso actual de la categoría (de ScoringService)
    sourceType:         'employer' | 'peer' | 'client';
    verifiedRelationship: boolean;
    sourceBias?: {                  // datos de sesgo por fuente (de ScoringService)
      consensus: number;
      sources: {
        employer: { avg: number | null; votes: number };
        peer:     { avg: number | null; votes: number };
        client:   { avg: number | null; votes: number };
      };
      minVotesMet: boolean;
    };
  }): Promise<FraudCheckResult> {
    const flags: Partial<FraudFlag>[] = [];

    // 1. Anomalía (varianza baja + velocidad alta)
    const anomalyFlags = this.checkAnomaly(params.savedRating, params.recentRatings);
    flags.push(...anomalyFlags);

    // 2. Votación recíproca
    const mutualFlags = await this.checkMutual({
      savedRating:          params.savedRating,
      reverseRating:        params.reverseRating,
      fromCompanyId:        params.fromUser.company_id,
      toCompanyId:          params.toUser.company_id,
      verifiedRelationship: params.verifiedRelationship,
      weightedConsensus:    params.weightedConsensus,
    });
    flags.push(...mutualFlags);

    // 3. Círculo de votación (A→B→C→A)
    const ringFlags = await this.checkVoteRing(
      params.fromUser.id,
      params.toUser.id,
      params.savedRating.id,
    );
    flags.push(...ringFlags);

    // 4. Sesgo de fuente
    if (params.sourceBias?.minVotesMet) {
      const biasFlags = this.checkSourceBias(
        params.savedRating,
        params.sourceBias,
      );
      flags.push(...biasFlags);
    }

    // Guardar todos los flags
    const saved = await Promise.all(
      flags.map((f) =>
        this.fraudFlagRepo.save(
          this.fraudFlagRepo.create({ ...f, rating_id: params.savedRating.id }),
        ),
      ),
    );

    const totalSeverity = saved.reduce((acc, f) => acc + Number(f.severity), 0);
    return { flags: saved, totalSeverity };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATRÓN 1 — ANOMALÍA
  // Varianza muy baja (votos en bloque) + velocidad alta (bot-like)
  // ─────────────────────────────────────────────────────────────────────────────

  private checkAnomaly(
    savedRating:   Rating,
    recentRatings: Rating[],
  ): Partial<FraudFlag>[] {
    if (recentRatings.length < ANOMALY_MIN_RATINGS) return [];

    const values  = recentRatings.map((r) => Number(r.score));
    const avg     = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;

    let anomalyScore = 0;

    if (variance < ANOMALY_VARIANCE_THRESHOLD) anomalyScore += 2;
    if (avg > 95 || avg < 10)                  anomalyScore += 1;

    for (let i = 0; i < recentRatings.length - 1; i++) {
      const diff =
        new Date(recentRatings[i].created_at).getTime() -
        new Date(recentRatings[i + 1].created_at).getTime();
      if (diff < ANOMALY_SPEED_MS) anomalyScore += 0.5;
    }

    if (anomalyScore > ANOMALY_SCORE_THRESHOLD) {
      return [{
        type:        'anomaly',
        severity:    Math.min(3, anomalyScore - ANOMALY_SCORE_THRESHOLD),
        detected_by: 'ai_light',
        notes:       `variance=${variance.toFixed(2)}, avg=${avg.toFixed(1)}`,
      }];
    }

    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATRÓN 2 — VOTACIÓN RECÍPROCA
  // Diferencia según si la relación está verificada o no.
  // Entre pares verificados: solo es sospechoso si el score es outlier.
  // Entre desconocidos: siempre es sospechoso si ocurre en la ventana de tiempo.
  // ─────────────────────────────────────────────────────────────────────────────

  private async checkMutual(params: {
    savedRating:          Rating;
    reverseRating:        Rating | null;
    fromCompanyId:        number | null;
    toCompanyId:          number | null;
    verifiedRelationship: boolean;
    weightedConsensus:    number;
  }): Promise<Partial<FraudFlag>[]> {
    const {
      savedRating,
      reverseRating,
      fromCompanyId,
      toCompanyId,
      verifiedRelationship,
      weightedConsensus,
    } = params;

    if (!reverseRating) return [];

    const timeDiff = Math.abs(
      Date.now() - new Date(reverseRating.created_at).getTime(),
    );

    const flags: Partial<FraudFlag>[] = [];

    if (!verifiedRelationship) {
      // Desconocidos — ventana corta, severidad alta
      if (timeDiff > MUTUAL_UNKNOWN_WINDOW_MS) return [];

      const alreadyFlagged = await this.fraudFlagRepo.findOne({
        where: { rating_id: reverseRating.id, type: 'mutual_unknown' },
      });

      if (!alreadyFlagged) {
        flags.push({
          type:        'mutual_unknown',
          severity:    2,
          detected_by: 'system',
          notes:       `timeDiff=${Math.round(timeDiff / 1000)}s`,
        });
      }
    } else {
      // Pares verificados — ventana más larga, pero solo es fraud si el score es outlier
      if (timeDiff > MUTUAL_PEER_WINDOW_MS) return [];

      // Solo sospechoso si ambas empresas son distintas Y el score se aleja del consenso
      const sameCompany = fromCompanyId !== null && fromCompanyId === toCompanyId;
      if (sameCompany) return [];

      const deviation = weightedConsensus > 0
        ? Math.abs(Number(savedRating.score) - weightedConsensus) / weightedConsensus
        : 0;

      if (deviation < MUTUAL_PEER_OUTLIER_GAP) return [];

      const alreadyFlagged = await this.fraudFlagRepo.findOne({
        where: { rating_id: reverseRating.id, type: 'mutual_peer_outlier' },
      });

      if (!alreadyFlagged) {
        flags.push({
          type:        'mutual_peer_outlier',
          severity:    1,
          detected_by: 'system',
          notes:       `deviation=${(deviation * 100).toFixed(1)}%, consensus=${weightedConsensus.toFixed(1)}`,
        });
      }
    }

    return flags;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATRÓN 3 — CÍRCULO DE VOTACIÓN (A→B→C→A)
  // BFS sobre el grafo de ratings recientes para detectar ciclos.
  // ─────────────────────────────────────────────────────────────────────────────

  private async checkVoteRing(
    fromUserId: number,
    toUserId:   number,
    ratingId:   number,
  ): Promise<Partial<FraudFlag>[]> {
    const since = new Date(Date.now() - RING_WINDOW_DAYS * 24 * 3600 * 1000);

    // Trae todos los ratings recientes que parten desde toUserId
    // para ver si alguno eventualmente llega de vuelta a fromUserId
    const recentEdges = await this.ratingRepo
      .createQueryBuilder('r')
      .select('r.from_user_id', 'from_id')
      .addSelect('r.to_user_id', 'to_id')
      .where('r.created_at > :since', { since })
      .getRawMany();

    // Construir grafo de adyacencia
    const graph = new Map<number, Set<number>>();
    for (const edge of recentEdges) {
      const from = Number(edge.from_id);
      const to   = Number(edge.to_id);
      if (!graph.has(from)) graph.set(from, new Set());
      graph.get(from)!.add(to);
    }

    // Agrega el rating recién guardado al grafo
    if (!graph.has(fromUserId)) graph.set(fromUserId, new Set());
    graph.get(fromUserId)!.add(toUserId);

    // BFS desde toUserId buscando si puede llegar a fromUserId
    const visited = new Set<number>();
    const queue:   Array<{ node: number; path: number[]; depth: number }> = [
      { node: toUserId, path: [toUserId], depth: 0 },
    ];

    while (queue.length > 0) {
      const { node, path, depth } = queue.shift()!;

      if (depth > RING_MAX_DEPTH) continue;
      if (visited.has(node)) continue;
      visited.add(node);

      const neighbors = graph.get(node) ?? new Set();

      for (const neighbor of neighbors) {
        if (neighbor === fromUserId && path.length > 1) {
          // Encontramos un ciclo
          return [{
            type:        'vote_ring',
            severity:    Math.min(3, path.length - 1),
            detected_by: 'system',
            notes:       `ring: ${[...path, fromUserId].join('→')}`,
          }];
        }

        if (!visited.has(neighbor)) {
          queue.push({ node: neighbor, path: [...path, neighbor], depth: depth + 1 });
        }
      }
    }

    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATRÓN 4 — SESGO DE FUENTE
  // Una fuente diverge sistemáticamente del consenso ponderado.
  // Ej: empleador vota 95, pares y clientes votan 60.
  // ─────────────────────────────────────────────────────────────────────────────

  private checkSourceBias(
    savedRating: Rating,
    biasData: {
      consensus: number;
      sources: {
        employer: { avg: number | null; votes: number };
        peer:     { avg: number | null; votes: number };
        client:   { avg: number | null; votes: number };
      };
    },
  ): Partial<FraudFlag>[] {
    const flags: Partial<FraudFlag>[] = [];
    const { consensus, sources } = biasData;

    if (consensus === 0) return [];

    for (const [source, data] of Object.entries(sources)) {
      if (data.avg === null) continue;

      const divergence = Math.abs(data.avg - consensus) / consensus;

      if (divergence >= SOURCE_BIAS_MIN_DIVERGENCE) {
        // Severidad proporcional a la divergencia
        const severity = Math.min(2, divergence * 2);

        flags.push({
          type:        'source_bias',
          severity:    Math.round(severity * 10) / 10,
          detected_by: 'system',
          notes:       `source=${source}, avg=${data.avg.toFixed(1)}, consensus=${consensus.toFixed(1)}, divergence=${(divergence * 100).toFixed(1)}%`,
        });
      }
    }

    return flags;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSULTAS PARA ADMIN Y RATINGS.SERVICE
  // ─────────────────────────────────────────────────────────────────────────────

  async getRiskScore(userId: number): Promise<number> {
    const result = await this.fraudFlagRepo
      .createQueryBuilder('flag')
      .innerJoin(Rating, 'rating', 'rating.id = flag.rating_id')
      .select('SUM(flag.severity)', 'risk')
      .where('rating.from_user_id = :id', { id: userId })
      .getRawOne();

    return Number(result?.risk) || 0;
  }

  async getFlagsForRating(ratingId: number): Promise<FraudFlag[]> {
    return this.fraudFlagRepo.find({ where: { rating_id: ratingId } });
  }
}