import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Rating } from './ratings.entity';
import { User } from '../users/users.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { RatingWeight } from '../scoring/rating-weight.entity';
import { FraudService } from '../fraud/fraud.service';
import { ScoringService } from '../scoring/scoring.service';

const RATE_LIMIT_PER_HOUR_USER    = 30;
const RATE_LIMIT_PER_HOUR_COMPANY = 100;
const COOLDOWN_MS_USER    = 5 * 60_000;   // 5 min entre votos al mismo usuario
const COOLDOWN_MS_COMPANY = 1 * 60_000;   // 1 min para empresas

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private ratingRepo: Repository<Rating>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(EvaluationCategory)
    private categoryRepo: Repository<EvaluationCategory>,

    @InjectRepository(RatingWeight)
    private ratingWeightRepo: Repository<RatingWeight>,

    private fraudService: FraudService,
    private scoringService: ScoringService,
  ) {}

  async create(data: {
    from_user_id:           number;
    to_user_id:             number;
    evaluation_category_id: number;
    score:                  number;
    source_type:            'employer' | 'peer' | 'client';
    context_type?:          string;
    interaction_frequency?: string;
    duration_months?:       number;
    company_id?:            number;
    employment_id?:         number;
    is_anonymous?:          boolean;
  }): Promise<Rating> {
    const { from_user_id, to_user_id, evaluation_category_id, score, source_type } = data;

    // ─── Validaciones ────────────────────────────────────────────────────────

    if (from_user_id === to_user_id)
      throw new BadRequestException('No podés votarte a vos mismo');

    const [fromUser, toUser, category] = await Promise.all([
      this.userRepo.findOne({ where: { id: from_user_id } }),
      this.userRepo.findOne({ where: { id: to_user_id } }),
      this.categoryRepo.findOne({ where: { id: evaluation_category_id, is_active: true } }),
    ]);

    if (!fromUser || fromUser.is_blocked)
      throw new BadRequestException('Usuario bloqueado o no encontrado');
    if (!toUser)
      throw new NotFoundException('Usuario destino no encontrado');
    if (!category)
      throw new BadRequestException('Categoría inválida o inactiva');

    const sourceHasWeight =
      (source_type === 'employer' && category.employer_weight > 0) ||
      (source_type === 'peer'     && category.peer_weight     > 0) ||
      (source_type === 'client'   && category.client_weight   > 0);

    if (!sourceHasWeight)
      throw new BadRequestException(`La fuente '${source_type}' no tiene peso en esta categoría`);

    // ─── Rate limit ──────────────────────────────────────────────────────────

    const recentCount = await this.ratingRepo.count({
      where: { from_user_id, created_at: MoreThan(new Date(Date.now() - 3_600_000)) },
    });
    const rateLimit = fromUser.role === 'company' ? RATE_LIMIT_PER_HOUR_COMPANY : RATE_LIMIT_PER_HOUR_USER;
    if (recentCount >= rateLimit)
      throw new BadRequestException('Límite de votos por hora alcanzado');

    // ─── Cooldown ────────────────────────────────────────────────────────────

    const lastRating = await this.ratingRepo.findOne({
      where: { from_user_id, to_user_id },
      order: { created_at: 'DESC' },
    });
    const cooldownMs = fromUser.role === 'company' ? COOLDOWN_MS_COMPANY : COOLDOWN_MS_USER;
    if (lastRating && Date.now() - new Date(lastRating.created_at).getTime() < cooldownMs)
      throw new BadRequestException('Cooldown activo para este usuario');

    // ─── Relación verificada ─────────────────────────────────────────────────

    const verifiedRelationship = await this.checkVerifiedRelationship(from_user_id, to_user_id);

    // ─── Guardar rating ──────────────────────────────────────────────────────

    const saved: Rating = await this.ratingRepo.save(
      this.ratingRepo.create({ ...data, verified_relationship: verifiedRelationship }),
    ) as Rating;

    // ─── Snapshot de pesos ───────────────────────────────────────────────────

    const weightSnapshot = await this.scoringService.buildWeightSnapshot({
      fromUser,
      category,
      sourceType:  source_type,
      contextType: data.context_type ?? 'occasional',
      createdAt:   saved.created_at,
    });

    await this.ratingWeightRepo.save(
      this.ratingWeightRepo.create({
        rating_id:          saved.id,
        source_weight:      weightSnapshot.source_weight,
        trust_weight:       weightSnapshot.trust_weight,
        reliability_weight: weightSnapshot.reliability_weight,
        context_weight:     weightSnapshot.context_weight,
        time_weight:        weightSnapshot.time_weight,
        anomaly_weight:     weightSnapshot.anomaly_weight,
        final_weight:       weightSnapshot.final_weight,
      }),
    );

    // ─── Score de categoría ──────────────────────────────────────────────────

    const { weightedConsensus } = await this.scoringService.updateCategoryScore({
      toUserId:    to_user_id,
      categoryId:  evaluation_category_id,
      score,
      sourceType:  source_type,
      finalWeight: weightSnapshot.final_weight,
    });

    // ─── Datos de sesgo por fuente ───────────────────────────────────────────

    const sourceBias = await this.scoringService.getSourceBiasData(
      to_user_id,
      evaluation_category_id,
    );

    // ─── Rating inverso ──────────────────────────────────────────────────────

    const reverseRating = await this.ratingRepo.findOne({
      where: { from_user_id: to_user_id, to_user_id: from_user_id },
      order: { created_at: 'DESC' },
    });

    // ─── Historial reciente del emisor ───────────────────────────────────────

    const recentRatings = await this.ratingRepo.find({
      where: { from_user_id },
      order: { created_at: 'DESC' },
      take:  50,
    });

    // ─── Fraud checks ────────────────────────────────────────────────────────

    const { totalSeverity } = await this.fraudService.runChecks({
      savedRating:          saved,
      recentRatings,
      reverseRating,
      fromUser:             { id: from_user_id, company_id: fromUser.company_id },
      toUser:               { id: to_user_id,   company_id: toUser.company_id   },
      weightedConsensus,
      sourceType:           source_type,
      verifiedRelationship,
      sourceBias,
    });

    // Actualizar anomaly_weight si hubo flags
    if (totalSeverity > 0) {
      const anomalyWeight = 1 / (1 + totalSeverity);
      await this.ratingWeightRepo.update(saved.id, {
        anomaly_weight: anomalyWeight,
        final_weight:   weightSnapshot.final_weight * anomalyWeight,
      });
    }

    // ─── Fraud scores ────────────────────────────────────────────────────────

    const [riskFrom, riskTo] = await Promise.all([
      this.fraudService.getRiskScore(from_user_id),
      this.fraudService.getRiskScore(to_user_id),
    ]);

    await Promise.all([
      this.scoringService.updateFraudScore(from_user_id, riskFrom),
      this.scoringService.updateFraudScore(to_user_id,   riskTo),
    ]);

    // ─── Confiabilidad del votante ───────────────────────────────────────────

    await this.scoringService.updateVoterReliability({
      fromUserId:        from_user_id,
      voteScore:         score,
      weightedConsensus,
    });

    // ─── Performance score global del receptor ───────────────────────────────

    await this.scoringService.updatePerformanceScore(to_user_id);

    return saved;
  }

  private async checkVerifiedRelationship(
    fromUserId: number,
    toUserId:   number,
  ): Promise<boolean> {
    const result = await this.ratingRepo.manager.query(
      `SELECT 1
       FROM employments e1
       JOIN employments e2
         ON e1.company_id = e2.company_id
        AND e1.user_id    = $1
        AND e2.user_id    = $2
        AND e1.verification_level >= 1
        AND e2.verification_level >= 1
       LIMIT 1`,
      [fromUserId, toUserId],
    );
    return result.length > 0;
  }

  // ─── Subáreas que fromUser puede evaluar sobre toUser ────────────────────────
  // Lógica:
  // 1. Obtener los job_types de los empleos activos del toUser
  // 2. Determinar qué relación tiene fromUser con toUser:
  //    - employer: fromUser tiene un empleo de tipo 'company' o es employer de toUser
  //      (en la misma empresa, pero el fromUser tiene role company)
  //    - peer: fromUser y toUser coinciden en al menos 1 empleo (misma empresa)
  //    - client: cualquier usuario puede ser cliente (no requiere empleo compartido)
  // 3. Filtrar las categorías activas de esos job_types según los pesos de la fuente
  async getEvaluableCategories(fromUserId: number, toUserId: number): Promise<{
    categories: EvaluationCategory[];
    available_sources: ('employer' | 'peer' | 'client')[];
    shared_companies: { id: number; name: string }[];
  }> {
    if (fromUserId === toUserId)
      return { categories: [], available_sources: [], shared_companies: [] };

    const em = this.ratingRepo.manager;

    // Empleos activos del toUser (sin end_date o end_date en el futuro)
    const toEmployments: { user_id: number; company_id: number; verification_level: number }[] =
      await em.query(
        `SELECT company_id, verification_level
         FROM employments
         WHERE user_id = $1 AND (end_date IS NULL OR end_date > CURRENT_DATE)`,
        [toUserId],
      );

    if (!toEmployments.length)
      return { categories: [], available_sources: [], shared_companies: [] };

    // Empleos del fromUser en las mismas empresas
    const toCompanyIds = toEmployments.map(e => e.company_id);
    const fromEmployments: { company_id: number; verification_level: number }[] =
      await em.query(
        `SELECT company_id, verification_level
         FROM employments
         WHERE user_id = $1 AND company_id = ANY($2)
           AND (end_date IS NULL OR end_date > CURRENT_DATE)`,
        [fromUserId, toCompanyIds],
      );

    // Empresas compartidas (para mostrar al usuario)
    const sharedCompanyIds = fromEmployments.map(e => e.company_id);
    const sharedCompanies: { id: number; name: string }[] = sharedCompanyIds.length
      ? await em.query(
          `SELECT id, name FROM companies WHERE id = ANY($1)`,
          [sharedCompanyIds],
        )
      : [];

    // El fromUser es de tipo 'company' (jefe/empresa)
    const fromUserRole: string = (await em.query(
      `SELECT role FROM users WHERE id = $1`,
      [fromUserId],
    ))[0]?.role ?? 'user';

    const availableSources: ('employer' | 'peer' | 'client')[] = [];

    // Employer: el fromUser tiene role 'company' y está en la misma empresa que toUser
    if (fromUserRole === 'company' && sharedCompanyIds.length > 0)
      availableSources.push('employer');

    // Peer: ambos tienen empleos en la misma empresa (y fromUser no es empresa)
    if (fromUserRole !== 'company' && sharedCompanyIds.length > 0)
      availableSources.push('peer');

    // Client: cualquiera (sin restricción de empresa compartida)
    availableSources.push('client');

    // job_type_ids de los empleos del toUser
    const jobTypeRows: { job_type_id: number }[] = await em.query(
      `SELECT DISTINCT uj.job_type_id
       FROM user_profiles uj
       WHERE uj.user_id = $1 AND uj.is_active = true`,
      [toUserId],
    );
    const jobTypeIds = jobTypeRows.map(r => r.job_type_id);

    if (!jobTypeIds.length)
      return { categories: [], available_sources: availableSources, shared_companies: sharedCompanies };

    // Categorías activas de esos job_types que al menos una fuente disponible puede usar
    const cats = await this.categoryRepo
      .createQueryBuilder('cat')
      .where('cat.job_type_id IN (:...jobTypeIds)', { jobTypeIds })
      .andWhere('cat.is_active = true')
      .andWhere(
        availableSources.map(s => ({
          employer: 'cat.employer_weight > 0',
          peer:     'cat.peer_weight > 0',
          client:   'cat.client_weight > 0',
        }[s])).join(' OR ') || '1=0',
      )
      .orderBy('cat.category_weight', 'DESC')
      .getMany();

    return { categories: cats, available_sources: availableSources, shared_companies: sharedCompanies };
  }

  async getReceived(userId: number) {
    return this.ratingRepo
      .createQueryBuilder('r')
      .innerJoin(User, 'fromUser', 'fromUser.id = r.from_user_id')
      .innerJoin(EvaluationCategory, 'cat', 'cat.id = r.evaluation_category_id')
      .select('r.id', 'id')
      .addSelect('r.score', 'score')
      .addSelect('r.source_type', 'source_type')
      .addSelect('r.created_at', 'created_at')
      .addSelect('r.is_anonymous', 'is_anonymous')
      .addSelect('cat.name', 'category')
      .addSelect(`CASE WHEN r.is_anonymous THEN 'Anónimo' ELSE fromUser.name END`, 'from_name')
      .where('r.to_user_id = :userId', { userId })
      .orderBy('r.created_at', 'DESC')
      .getRawMany();
  }

  async getGiven(userId: number) {
    return this.ratingRepo
      .createQueryBuilder('r')
      .innerJoin(User, 'toUser', 'toUser.id = r.to_user_id')
      .innerJoin(EvaluationCategory, 'cat', 'cat.id = r.evaluation_category_id')
      .select('r.id', 'id')
      .addSelect('r.score', 'score')
      .addSelect('r.source_type', 'source_type')
      .addSelect('r.created_at', 'created_at')
      .addSelect('cat.name', 'category')
      .addSelect('toUser.name', 'to_name')
      .where('r.from_user_id = :userId', { userId })
      .orderBy('r.created_at', 'DESC')
      .getRawMany();
  }
}