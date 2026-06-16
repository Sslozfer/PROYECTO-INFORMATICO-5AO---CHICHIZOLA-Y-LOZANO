import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/users.entity';
import { UserCategoryScore } from './user-category-score.entity';
import { VoterReliability } from './voter-reliability.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { RatingWeightSnapshot } from './rating-weight.interface';
import { ScoreChangeLog } from './score-change-log.entity';
import { getContextWeight, getTimeWeight } from '../../common/weights/weights';

// ─── Umbrales configurables ───────────────────────────────────────────────────
const DEVIATION_THRESHOLD       = 0.5;   // 50% de desviación sobre el consenso → sospechoso
const STREAK_TO_PENALIZE        = 3;     // votos consecutivos fuera del consenso → baja reliability
const STREAK_TO_RECOVER         = 5;     // votos consecutivos dentro del consenso → sube reliability
const RELIABILITY_PENALTY       = 0.15;  // cuánto baja por streak de penalización
const RELIABILITY_RECOVERY      = 0.10;  // cuánto sube por streak de recuperación
const RELIABILITY_MIN           = 0.2;   // piso de reliability
const RELIABILITY_MAX           = 1.0;   // techo de reliability
const MIN_VOTES_FOR_BIAS_CHECK  = 5;     // mínimo de votos por fuente para activar detección de sesgo

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(UserCategoryScore)
    private categoryScoreRepo: Repository<UserCategoryScore>,

    @InjectRepository(VoterReliability)
    private reliabilityRepo: Repository<VoterReliability>,

    @InjectRepository(EvaluationCategory)
    private categoryRepo: Repository<EvaluationCategory>,

    @InjectRepository(ScoreChangeLog)
    private changeLogRepo: Repository<ScoreChangeLog>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // PESOS DEL VOTO
  // Construye el snapshot de pesos para un rating dado.
  // Se llama ANTES de guardar en rating_weights.
  // ─────────────────────────────────────────────────────────────────────────────

  async buildWeightSnapshot(params: {
    fromUser: User;
    category: EvaluationCategory;
    sourceType: 'employer' | 'peer' | 'client';
    contextType: string;
    createdAt: Date;
    anomalyWeight?: number;
  }): Promise<RatingWeightSnapshot> {
    const { fromUser, category, sourceType, contextType, createdAt, anomalyWeight = 1 } = params;

    const sourceWeight  = this.getSourceWeight(category, sourceType);
    const trustWeight   = this.normalizeTrust(fromUser.global_trust_score);
    const reliability   = await this.getReliability(fromUser.id);
    const contextWeight = getContextWeight(contextType);
    const timeWeight    = getTimeWeight(createdAt);

    const finalWeight =
      sourceWeight *
      trustWeight  *
      reliability  *
      contextWeight *
      timeWeight   *
      anomalyWeight;

    return {
      source_weight:      sourceWeight,
      trust_weight:       trustWeight,
      reliability_weight: reliability,
      context_weight:     contextWeight,
      time_weight:        timeWeight,
      anomaly_weight:     anomalyWeight,
      final_weight:       finalWeight,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTUALIZACIÓN DE SCORE POR CATEGORÍA (incremental O(1))
  // Actualiza user_category_scores para el receptor del voto.
  // Devuelve el consenso ponderado actual (necesario para fraud.service).
  // ─────────────────────────────────────────────────────────────────────────────

  async updateCategoryScore(params: {
    toUserId: number;
    categoryId: number;
    score: number;
    sourceType: 'employer' | 'peer' | 'client';
    finalWeight: number;
  }): Promise<{ newScore: number; weightedConsensus: number }> {
    const { toUserId, categoryId, score, sourceType, finalWeight } = params;

    let record = await this.categoryScoreRepo.findOne({
      where: { user_id: toUserId, evaluation_category_id: categoryId },
    });

    if (!record) {
      record = this.categoryScoreRepo.create({
        user_id:               toUserId,
        evaluation_category_id: categoryId,
        score:                 0,
        confidence:            0,
        vote_count:            0,
        employer_weighted_sum: 0,
        employer_weight_sum:   0,
        peer_weighted_sum:     0,
        peer_weight_sum:       0,
        client_weighted_sum:   0,
        client_weight_sum:     0,
      });
    }

    // Acumuladores por fuente
    if (sourceType === 'employer') {
      record.employer_weighted_sum += score * finalWeight;
      record.employer_weight_sum   += finalWeight;
    } else if (sourceType === 'peer') {
      record.peer_weighted_sum += score * finalWeight;
      record.peer_weight_sum   += finalWeight;
    } else {
      record.client_weighted_sum += score * finalWeight;
      record.client_weight_sum   += finalWeight;
    }

    // Score global = suma de todos los acumuladores
    const totalWeightedSum =
      record.employer_weighted_sum +
      record.peer_weighted_sum     +
      record.client_weighted_sum;

    const totalWeightSum =
      record.employer_weight_sum +
      record.peer_weight_sum     +
      record.client_weight_sum;

    const newScore = totalWeightSum > 0 ? totalWeightedSum / totalWeightSum : 0;

    record.score        = newScore;
    record.vote_count   = (record.vote_count || 0) + 1;
    record.confidence   = this.calculateConfidence(record.vote_count);
    record.last_updated = new Date();

    await this.categoryScoreRepo.save(record);

    return { newScore, weightedConsensus: newScore };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DATOS DE SESGO POR FUENTE
  // Expone los promedios por fuente para que fraud.service detecte divergencias.
  // ─────────────────────────────────────────────────────────────────────────────

  async getSourceBiasData(toUserId: number, categoryId: number): Promise<{
    consensus: number;
    sources: {
      employer: { avg: number | null; votes: number };
      peer:     { avg: number | null; votes: number };
      client:   { avg: number | null; votes: number };
    };
    minVotesMet: boolean;
  }> {
    const record = await this.categoryScoreRepo.findOne({
      where: { user_id: toUserId, evaluation_category_id: categoryId },
    });

    if (!record) {
      return {
        consensus: 0,
        sources: {
          employer: { avg: null, votes: 0 },
          peer:     { avg: null, votes: 0 },
          client:   { avg: null, votes: 0 },
        },
        minVotesMet: false,
      };
    }

    const employerAvg = record.employer_weight_sum > 0
      ? record.employer_weighted_sum / record.employer_weight_sum : null;
    const peerAvg = record.peer_weight_sum > 0
      ? record.peer_weighted_sum / record.peer_weight_sum : null;
    const clientAvg = record.client_weight_sum > 0
      ? record.client_weighted_sum / record.client_weight_sum : null;

    const totalWeightSum =
      record.employer_weight_sum +
      record.peer_weight_sum     +
      record.client_weight_sum;

    const totalWeightedSum =
      record.employer_weighted_sum +
      record.peer_weighted_sum     +
      record.client_weighted_sum;

    const consensus = totalWeightSum > 0 ? totalWeightedSum / totalWeightSum : 0;

    const employerVotes = record.employer_weight_sum > 0
      ? Math.round(record.employer_weight_sum) : 0;
    const peerVotes = record.peer_weight_sum > 0
      ? Math.round(record.peer_weight_sum) : 0;
    const clientVotes = record.client_weight_sum > 0
      ? Math.round(record.client_weight_sum) : 0;

    const minVotesMet =
      employerVotes >= MIN_VOTES_FOR_BIAS_CHECK ||
      peerVotes     >= MIN_VOTES_FOR_BIAS_CHECK ||
      clientVotes   >= MIN_VOTES_FOR_BIAS_CHECK;

    return {
      consensus,
      sources: {
        employer: { avg: employerAvg, votes: employerVotes },
        peer:     { avg: peerAvg,     votes: peerVotes     },
        client:   { avg: clientAvg,   votes: clientVotes   },
      },
      minVotesMet,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIABILIDAD DINÁMICA DEL VOTANTE
  // Actualiza el streak del votante según si su voto fue outlier o no.
  // ─────────────────────────────────────────────────────────────────────────────

  async updateVoterReliability(params: {
    fromUserId: number;
    voteScore: number;
    weightedConsensus: number;
  }): Promise<number> {
    const { fromUserId, voteScore, weightedConsensus } = params;

    let record = await this.reliabilityRepo.findOne({
      where: { user_id: fromUserId },
    });

    if (!record) {
      record = this.reliabilityRepo.create({
        user_id:          fromUserId,
        reliability:      RELIABILITY_MAX,
        deviation_streak: 0,
        recovery_streak:  0,
        total_votes_cast: 0,
      });
    }

    record.total_votes_cast += 1;

    const deviation = weightedConsensus > 0
      ? Math.abs(voteScore - weightedConsensus) / weightedConsensus
      : 0;

    const isOutlier = deviation > DEVIATION_THRESHOLD;

    if (isOutlier) {
      record.deviation_streak += 1;
      record.recovery_streak   = 0;

      if (record.deviation_streak >= STREAK_TO_PENALIZE) {
        const oldReliability = record.reliability;
        record.reliability = Math.max(RELIABILITY_MIN, record.reliability - RELIABILITY_PENALTY);

        await this.logScoreChange({
          userId: fromUserId,
          field:  'reliability',
          delta:  record.reliability - oldReliability,
          reason: `deviation_streak=${record.deviation_streak}, deviation=${deviation.toFixed(2)}`,
        });

        record.deviation_streak = 0;
      }
    } else {
      record.recovery_streak  += 1;
      record.deviation_streak  = 0;

      if (record.recovery_streak >= STREAK_TO_RECOVER) {
        const oldReliability = record.reliability;
        record.reliability = Math.min(RELIABILITY_MAX, record.reliability + RELIABILITY_RECOVERY);

        await this.logScoreChange({
          userId: fromUserId,
          field:  'reliability',
          delta:  record.reliability - oldReliability,
          reason: `recovery_streak=${record.recovery_streak}`,
        });

        record.recovery_streak = 0;
      }
    }

    record.last_updated = new Date();
    await this.reliabilityRepo.save(record);

    return record.reliability;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERFORMANCE SCORE GLOBAL
  // Promedio ponderado de user_category_scores usando category_weight,
  // escalado por confidence para no inflar categorías con pocos votos.
  // ─────────────────────────────────────────────────────────────────────────────

  async updatePerformanceScore(userId: number): Promise<void> {
    const rows = await this.categoryScoreRepo
      .createQueryBuilder('ucs')
      .innerJoin(
        EvaluationCategory,
        'cat',
        'cat.id = ucs.evaluation_category_id AND cat.is_active = true',
      )
      .select('ucs.score',           'score')
      .addSelect('cat.category_weight', 'weight')
      .addSelect('ucs.confidence',    'confidence')
      .where('ucs.user_id = :userId', { userId })
      .getRawMany();

    if (rows.length === 0) return;

    let weightedSum = 0;
    let weightSum   = 0;

    for (const row of rows) {
      const effectiveWeight = Number(row.weight) * Number(row.confidence);
      weightedSum += Number(row.score) * effectiveWeight;
      weightSum   += effectiveWeight;
    }

    const performanceScore = weightSum > 0 ? weightedSum / weightSum : 0;

    await this.userRepo.update(userId, {
      performance_score: Math.round(performanceScore * 10) / 10,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FRAUD SCORE Y BLOQUEO
  // ─────────────────────────────────────────────────────────────────────────────

  async updateFraudScore(userId: number, riskScore: number): Promise<void> {
    const isBlocked = riskScore >= 11;

    await this.userRepo.update(userId, {
      fraud_score: riskScore,
      is_blocked:  isBlocked,
    });

    if (isBlocked) {
      await this.logScoreChange({
        userId,
        field:  'fraud_score',
        delta:  riskScore,
        reason: 'fraud_score_threshold_exceeded',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────────

  private getSourceWeight(
    category: EvaluationCategory,
    sourceType: 'employer' | 'peer' | 'client',
  ): number {
    const raw =
      sourceType === 'employer' ? category.employer_weight :
      sourceType === 'peer'     ? category.peer_weight     :
                                  category.client_weight;

    const total =
      category.employer_weight +
      category.peer_weight     +
      category.client_weight;

    return total > 0 ? raw / total : 0;
  }

  private normalizeTrust(globalTrustScore: number): number {
    return Math.max(0.1, Math.min(globalTrustScore / 100, 1.0));
  }

  private async getReliability(userId: number): Promise<number> {
    const record = await this.reliabilityRepo.findOne({ where: { user_id: userId } });
    return record?.reliability ?? RELIABILITY_MAX;
  }

  // Confianza sube rápido al principio y se aplana: con 10 votos = 0.5, con 40 = 0.8
  private calculateConfidence(voteCount: number): number {
    return Math.min(1.0, voteCount / (voteCount + 10));
  }

  private async logScoreChange(params: {
    userId: number;
    field:  string;
    delta:  number;
    reason: string;
  }): Promise<void> {
    await this.changeLogRepo.save({
      user_id:    params.userId,
      field:      params.field,
      delta:      params.delta,
      reason:     params.reason,
      created_at: new Date(),
    });
  }
}