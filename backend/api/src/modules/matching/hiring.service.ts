import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobApplication } from './job-application.entity';
import { JobPost } from './job-post.entity';
import { User } from '../users/users.entity';
import { MatchingService } from './matching.service';

// Cuánto tiempo tiene el candidato para responder una oferta automática
const AUTO_OFFER_TTL_HOURS = 48;

@Injectable()
export class HiringService {
  constructor(
    @InjectRepository(JobApplication)
    private applicationRepo: Repository<JobApplication>,

    @InjectRepository(JobPost)
    private jobPostRepo: Repository<JobPost>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    private matchingService: MatchingService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // APLICAR A UN PUESTO
  // El candidato aplica manualmente. Si el post es auto, evalúa condiciones.
  // ─────────────────────────────────────────────────────────────────────────────

  async apply(userId: number, jobPostId: number): Promise<JobApplication> {
    const [post, user] = await Promise.all([
      this.jobPostRepo.findOne({ where: { id: jobPostId, is_active: true } }),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);

    if (!post) throw new NotFoundException('Publicación no encontrada o inactiva');
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.is_blocked) throw new BadRequestException('Usuario bloqueado');

    // Verificar que no haya aplicado antes
    const existing = await this.applicationRepo.findOne({
      where: { job_post_id: jobPostId, user_id: userId },
    });
    if (existing) throw new BadRequestException('Ya aplicaste a este puesto');

    // Calcular compatibilidad
    const matches = await this.matchingService.findPostsForUser(userId, post.job_type_id);
    const matchForPost = matches.find(m => m.job_post_id === jobPostId);
    const compatibilityScore = matchForPost?.match.compatibility_score ?? 0;

    // Evaluar condiciones de auto-aceptación
    const { autoAccepted, conditionsSnapshot } = this.evaluateAutoConditions(
      post, user, compatibilityScore, matchForPost?.match,
    );

    const status = autoAccepted ? 'auto_accepted' : 'pending';
    const expiresAt = autoAccepted
      ? new Date(Date.now() + (post.auto_offer_ttl_hours ?? AUTO_OFFER_TTL_HOURS) * 3_600_000)
      : null;

    const application = this.applicationRepo.create({
      job_post_id:          jobPostId,
      user_id:              userId,
      mode:                 post.hiring_mode,
      status,
      compatibility_score:  compatibilityScore,
      conditions_snapshot:  conditionsSnapshot,
      auto_offer_expires_at: expiresAt,
    });

    return this.applicationRepo.save(application) as Promise<JobApplication>;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CANDIDATO ACEPTA O RECHAZA UNA OFERTA AUTOMÁTICA
  // ─────────────────────────────────────────────────────────────────────────────

  async respondToOffer(
    userId:        number,
    applicationId: number,
    accept:        boolean,
    reason?:       string,
  ): Promise<JobApplication> {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, user_id: userId },
    });

    if (!application) throw new NotFoundException('Aplicación no encontrada');

    if (application.status !== 'auto_accepted')
      throw new BadRequestException('Esta aplicación no tiene una oferta pendiente de respuesta');

    if (application.auto_offer_expires_at && new Date() > application.auto_offer_expires_at)
      throw new BadRequestException('La oferta expiró');

    application.status = accept ? 'accepted' : 'rejected_by_candidate';
    if (!accept && reason) application.rejection_reason = reason;

    return this.applicationRepo.save(application) as Promise<JobApplication>;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EMPRESA ACEPTA O RECHAZA UNA APLICACIÓN MANUAL
  // ─────────────────────────────────────────────────────────────────────────────

  async reviewApplication(
    companyUserId: number,
    applicationId: number,
    accept:        boolean,
    reason?:       string,
  ): Promise<JobApplication> {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
    });

    if (!application) throw new NotFoundException('Aplicación no encontrada');

    // Verificar que el post pertenece a esta empresa
    const post = await this.jobPostRepo.findOne({
      where: { id: application.job_post_id, company_id: companyUserId },
    });
    if (!post) throw new BadRequestException('No tenés permisos sobre esta aplicación');

    if (!['pending'].includes(application.status))
      throw new BadRequestException('Esta aplicación ya fue procesada');

    application.status = accept ? 'accepted' : 'rejected_by_company';
    if (!accept && reason) application.rejection_reason = reason;

    return this.applicationRepo.save(application) as Promise<JobApplication>;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CANDIDATO RETIRA SU APLICACIÓN
  // ─────────────────────────────────────────────────────────────────────────────

  async withdraw(userId: number, applicationId: number): Promise<JobApplication> {
    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, user_id: userId },
    });

    if (!application) throw new NotFoundException('Aplicación no encontrada');

    if (['accepted', 'rejected_by_company', 'withdrawn'].includes(application.status))
      throw new BadRequestException('No se puede retirar esta aplicación');

    application.status = 'withdrawn';
    return this.applicationRepo.save(application) as Promise<JobApplication>;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSULTAS
  // ─────────────────────────────────────────────────────────────────────────────

  async getMyApplications(userId: number) {
    const apps = await this.applicationRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
    // Enriquecer con datos del job_post
    const postIds = [...new Set(apps.map(a => a.job_post_id))];
    if (!postIds.length) return [];
    const posts = await this.jobPostRepo.findByIds(postIds);
    const postMap = new Map(posts.map(p => [p.id, p]));
    return apps.map(a => ({
      ...a,
      job_post: postMap.get(a.job_post_id) ?? null,
    }));
  }

  async getApplicationsForPost(
    companyUserId: number,
    jobPostId:     number,
  ): Promise<JobApplication[]> {
    // Verificar que el post pertenece a esta empresa
    const post = await this.jobPostRepo.findOne({
      where: { id: jobPostId, company_id: companyUserId },
    });
    if (!post) throw new BadRequestException('No tenés permisos sobre esta publicación');

    return this.applicationRepo.find({
      where: { job_post_id: jobPostId },
      order: { compatibility_score: 'DESC' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVALUACIÓN DE CONDICIONES DE AUTO-ACEPTACIÓN
  // ─────────────────────────────────────────────────────────────────────────────

  private evaluateAutoConditions(
    post:               JobPost,
    user:               User,
    compatibilityScore: number,
    matchDetails?:      any,
  ): { autoAccepted: boolean; conditionsSnapshot: Record<string, any> } {

    if (post.hiring_mode === 'manual') {
      return { autoAccepted: false, conditionsSnapshot: {} };
    }

    const checks: Record<string, { required: any; actual: any; passed: boolean }> = {};

    // Condición 1: Compatibilidad mínima
    if (post.auto_min_compatibility != null) {
      checks.min_compatibility = {
        required: post.auto_min_compatibility,
        actual:   compatibilityScore,
        passed:   compatibilityScore >= post.auto_min_compatibility,
      };
    }

    // Condición 2: Score mínimo por categoría
    if (post.auto_min_category_score != null && matchDetails?.details) {
      const categoryScores = Object.values(matchDetails.details) as number[];
      const allPass = categoryScores.every(s => s >= post.auto_min_category_score!);
      const minActual = categoryScores.length > 0 ? Math.min(...categoryScores) : 0;

      checks.min_category_score = {
        required: post.auto_min_category_score,
        actual:   minActual,
        passed:   allPass,
      };
    }

    // Condición 3: Distancia máxima
    if (post.auto_max_distance_km != null && matchDetails?.distance_km != null) {
      checks.max_distance = {
        required: post.auto_max_distance_km,
        actual:   matchDetails.distance_km,
        passed:   matchDetails.distance_km <= post.auto_max_distance_km,
      };
    }

    // Condición 4: Identidad verificada
    if (post.auto_require_identity) {
      checks.identity_verified = {
        required: true,
        actual:   user.identity_verified,
        passed:   user.identity_verified,
      };
    }

    const autoAccepted =
      post.hiring_mode !== 'manual' &&
      Object.values(checks).length > 0 &&
      Object.values(checks).every(c => c.passed);

    return { autoAccepted, conditionsSnapshot: checks };
  }
}