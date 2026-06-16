import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudFlag } from '../fraud/fraud-flag.entity';
import { Rating } from '../ratings/ratings.entity';
import { User } from '../users/users.entity';
import { VoterReliability } from '../scoring/voter-reliability.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(FraudFlag)
    private fraudRepo: Repository<FraudFlag>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(VoterReliability)
    private reliabilityRepo: Repository<VoterReliability>,

    @InjectRepository(UserCategoryScore)
    private categoryScoreRepo: Repository<UserCategoryScore>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // FRAUDE — resúmenes
  // ─────────────────────────────────────────────────────────────────────────────

  // Total de flags por usuario emisor, agrupado
  async getFraudSummary() {
    return this.fraudRepo
      .createQueryBuilder('flag')
      .innerJoin(Rating, 'rating', 'rating.id = flag.rating_id')
      .select('rating.from_user_id', 'user_id')
      .addSelect('COUNT(*)',          'total_flags')
      .addSelect('SUM(flag.severity)', 'total_severity')
      .groupBy('rating.from_user_id')
      .orderBy('total_severity', 'DESC')
      .getRawMany();
  }

  // Flags por usuario y por tipo — útil para ver qué patrón domina
  async getFraudDetailed() {
    return this.fraudRepo
      .createQueryBuilder('flag')
      .innerJoin(Rating, 'rating', 'rating.id = flag.rating_id')
      .select('rating.from_user_id',  'user_id')
      .addSelect('flag.type',          'type')
      .addSelect('COUNT(*)',            'count')
      .addSelect('SUM(flag.severity)', 'severity_sum')
      .addSelect('flag.notes',         'sample_notes')
      .groupBy('rating.from_user_id')
      .addGroupBy('flag.type')
      .addGroupBy('flag.notes')
      .orderBy('severity_sum', 'DESC')
      .getRawMany();
  }

  // Usuarios de alto riesgo (fraud_score >= umbral)
  async getHighRiskUsers(minRisk = 5) {
    return this.userRepo
      .createQueryBuilder('user')
      .select('user.id',           'user_id')
      .addSelect('user.name',       'name')
      .addSelect('user.fraud_score', 'fraud_score')
      .addSelect('user.is_blocked',  'is_blocked')
      .where('user.fraud_score >= :minRisk', { minRisk })
      .orderBy('user.fraud_score', 'DESC')
      .getRawMany();
  }

  // Pares sospechosos — muchas interacciones con flags
  async getSuspiciousPairs() {
    return this.fraudRepo
      .createQueryBuilder('flag')
      .innerJoin(Rating, 'rating', 'rating.id = flag.rating_id')
      .select('rating.from_user_id', 'user1')
      .addSelect('rating.to_user_id', 'user2')
      .addSelect('COUNT(*)',           'flag_count')
      .addSelect('SUM(flag.severity)', 'severity_sum')
      .groupBy('rating.from_user_id')
      .addGroupBy('rating.to_user_id')
      .orderBy('severity_sum', 'DESC')
      .limit(50)
      .getRawMany();
  }

  // Flags por tipo — visión global de qué patrones son más comunes
  async getFraudByType() {
    return this.fraudRepo
      .createQueryBuilder('flag')
      .select('flag.type',             'type')
      .addSelect('COUNT(*)',            'total')
      .addSelect('SUM(flag.severity)', 'severity_sum')
      .addSelect('AVG(flag.severity)', 'severity_avg')
      .groupBy('flag.type')
      .orderBy('total', 'DESC')
      .getRawMany();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FRAUDE — grafo y clusters
  // ─────────────────────────────────────────────────────────────────────────────

  async getFraudGraph() {
    return this.fraudRepo
      .createQueryBuilder('flag')
      .innerJoin(Rating, 'rating', 'rating.id = flag.rating_id')
      .select('rating.from_user_id', 'source')
      .addSelect('rating.to_user_id', 'target')
      .addSelect('COUNT(*)',           'weight')
      .groupBy('rating.from_user_id')
      .addGroupBy('rating.to_user_id')
      .having('COUNT(*) > 1')
      .getRawMany();
  }

  // Detección de clusters por DFS sobre el grafo de fraude
  async getFraudClusters() {
    const edges = await this.getFraudGraph();

    const graph = new Map<number, Set<number>>();
    for (const e of edges) {
      const source = Number(e.source);
      const target = Number(e.target);
      if (!graph.has(source)) graph.set(source, new Set());
      if (!graph.has(target)) graph.set(target, new Set());
      graph.get(source)!.add(target);
      graph.get(target)!.add(source);
    }

    const visited  = new Set<number>();
    const clusters: number[][] = [];

    const dfs = (node: number, cluster: number[]) => {
      if (visited.has(node)) return;
      visited.add(node);
      cluster.push(node);
      for (const n of graph.get(node) ?? []) dfs(n, cluster);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        const cluster: number[] = [];
        dfs(node, cluster);
        if (cluster.length > 1) clusters.push(cluster);
      }
    }

    return { count: clusters.length, clusters };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIABILIDAD DE VOTANTES
  // ─────────────────────────────────────────────────────────────────────────────

  // Votantes con reliability baja — posibles manipuladores sistemáticos
  async getLowReliabilityVoters(maxReliability = 0.6) {
    return this.reliabilityRepo
      .createQueryBuilder('vr')
      .innerJoin(User, 'user', 'user.id = vr.user_id')
      .select('vr.user_id',          'user_id')
      .addSelect('user.name',         'name')
      .addSelect('vr.reliability',    'reliability')
      .addSelect('vr.total_votes_cast', 'total_votes')
      .where('vr.reliability <= :maxReliability', { maxReliability })
      .orderBy('vr.reliability', 'ASC')
      .getRawMany();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SESGO DE FUENTE — quién tiene mayor divergencia entre fuentes
  // ─────────────────────────────────────────────────────────────────────────────

  async getSourceBiasReport(minDivergence = 0.35) {
    const rows = await this.categoryScoreRepo
      .createQueryBuilder('ucs')
      .innerJoin(EvaluationCategory, 'cat', 'cat.id = ucs.evaluation_category_id')
      .select('ucs.user_id',                'user_id')
      .addSelect('cat.name',                 'category')
      .addSelect('ucs.score',                'global_score')
      .addSelect('ucs.employer_weighted_sum / NULLIF(ucs.employer_weight_sum, 0)', 'employer_avg')
      .addSelect('ucs.peer_weighted_sum     / NULLIF(ucs.peer_weight_sum,     0)', 'peer_avg')
      .addSelect('ucs.client_weighted_sum   / NULLIF(ucs.client_weight_sum,   0)', 'client_avg')
      .where('ucs.vote_count >= 5')
      .getRawMany();

    // Filtrar los que tienen divergencia real entre fuentes
    return rows.filter((row) => {
      const avgs = [
        Number(row.employer_avg),
        Number(row.peer_avg),
        Number(row.client_avg),
      ].filter((v) => !isNaN(v) && v > 0);

      if (avgs.length < 2) return false;

      const max = Math.max(...avgs);
      const min = Math.min(...avgs);
      const divergence = (max - min) / max;

      return divergence >= minDivergence;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // USUARIOS BLOQUEADOS
  // ─────────────────────────────────────────────────────────────────────────────

  async getBlockedUsers() {
    return this.userRepo.find({
      where:  { is_blocked: true },
      select: ['id', 'name', 'email', 'fraud_score'],
      order:  { fraud_score: 'DESC' },
    });
  }

  async unblockUser(userId: number): Promise<void> {
    await this.userRepo.update(userId, {
      is_blocked:  false,
      fraud_score: 0,
    });
  }
}