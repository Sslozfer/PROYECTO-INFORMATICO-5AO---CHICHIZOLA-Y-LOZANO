import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPost } from './job-post.entity';
import { UserProfile } from './user-profile.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';

// Radio máximo de búsqueda en km si no se especifica
const DEFAULT_RADIUS_KM = 50;

export interface MatchResult {
  compatibility_score: number;   // 0–100
  score_match:         number;   // qué tan bien encajan los scores
  location_match:      number;   // 0–100, 100 = misma ubicación
  salary_match:        boolean;
  modality_match:      boolean;
  distance_km:         number | null;
  details:             Record<string, number>; // score por categoría vs mínimo requerido
}

export interface UserMatch {
  user_id:    number;
  job_post_id: number;
  match:      MatchResult;
}

export interface JobMatch {
  job_post_id: number;
  company_id:  number;
  title:       string;
  match:       MatchResult;
}

@Injectable()
export class MatchingService {
  constructor(
    @InjectRepository(JobPost)
    private jobPostRepo: Repository<JobPost>,

    @InjectRepository(UserProfile)
    private userProfileRepo: Repository<UserProfile>,

    @InjectRepository(UserCategoryScore)
    private categoryScoreRepo: Repository<UserCategoryScore>,

    @InjectRepository(EvaluationCategory)
    private categoryRepo: Repository<EvaluationCategory>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // EMPRESA BUSCA EMPLEADOS
  // Dado un job_post, devuelve usuarios ordenados por compatibilidad
  // ─────────────────────────────────────────────────────────────────────────────

  async findCandidatesForPost(jobPostId: number): Promise<UserMatch[]> {
    const post = await this.jobPostRepo.findOne({ where: { id: jobPostId, is_active: true } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    // Buscar perfiles activos del mismo job_type
    const profiles = await this.userProfileRepo.find({
      where: { job_type_id: post.job_type_id, is_active: true },
    });

    const results: UserMatch[] = [];

    for (const profile of profiles) {
      const match = await this.calculateMatch(profile, post);
      if (match.compatibility_score > 0) {
        results.push({ user_id: profile.user_id, job_post_id: post.id, match });
      }
    }

    return results.sort((a, b) => b.match.compatibility_score - a.match.compatibility_score);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EMPLEADO BUSCA TRABAJO
  // Dado un user_id y job_type_id, devuelve posts ordenados por compatibilidad
  // ─────────────────────────────────────────────────────────────────────────────

  async findPostsForUser(userId: number, jobTypeId: number): Promise<JobMatch[]> {
    const profile = await this.userProfileRepo.findOne({
      where: { user_id: userId, job_type_id: jobTypeId, is_active: true },
    });
    if (!profile) throw new NotFoundException('Perfil de búsqueda no encontrado');

    const posts = await this.jobPostRepo.find({
      where: { job_type_id: jobTypeId, is_active: true },
    });

    const results: JobMatch[] = [];

    for (const post of posts) {
      const match = await this.calculateMatch(profile, post);
      if (match.compatibility_score > 0) {
        results.push({
          job_post_id: post.id,
          company_id:  post.company_id,
          title:       post.title,
          match,
        });
      }
    }

    return results.sort((a, b) => b.match.compatibility_score - a.match.compatibility_score);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CÁLCULO DE COMPATIBILIDAD
  // ─────────────────────────────────────────────────────────────────────────────

  private async calculateMatch(
    profile: UserProfile,
    post:    JobPost,
  ): Promise<MatchResult> {

    // ─── 1. Score por categorías ─────────────────────────────────────────────
    const { scoreMatch, details } = await this.calculateScoreMatch(
      profile.user_id,
      post.job_type_id,
      post.min_category_scores,
    );

    // ─── 2. Distancia geográfica ─────────────────────────────────────────────
    const { locationMatch, distanceKm } = this.calculateLocationMatch(profile, post);

    // ─── 3. Salario ──────────────────────────────────────────────────────────
    const salaryMatch = this.calculateSalaryMatch(profile, post);

    // ─── 4. Modalidad ────────────────────────────────────────────────────────
    const modalityMatch = this.calculateModalityMatch(profile, post);

    // ─── 5. Score final ponderado ────────────────────────────────────────────
    // Pesos: score 50%, ubicación 30%, salario 10%, modalidad 10%
    // Si salary o modalidad no matchean, penalizan el score final
    const salaryFactor   = salaryMatch   ? 1 : 0.7;
    const modalityFactor = modalityMatch ? 1 : 0.8;

    const compatibilityScore = Math.round(
      scoreMatch * 0.5 +
      locationMatch * 0.3 +
      (salaryMatch   ? 10 : 0) +
      (modalityMatch ? 10 : 0)
    ) * salaryFactor * modalityFactor;

    return {
      compatibility_score: Math.min(100, Math.round(compatibilityScore)),
      score_match:         Math.round(scoreMatch),
      location_match:      Math.round(locationMatch),
      salary_match:        salaryMatch,
      modality_match:      modalityMatch,
      distance_km:         distanceKm,
      details,
    };
  }

  // ─── Score por categorías ────────────────────────────────────────────────────

  private async calculateScoreMatch(
    userId:           number,
    jobTypeId:        number,
    minScores:        Record<string, number> | null,
  ): Promise<{ scoreMatch: number; details: Record<string, number> }> {

    // Traer scores del usuario para este job_type
    const categoryScores = await this.categoryScoreRepo
      .createQueryBuilder('ucs')
      .innerJoin(EvaluationCategory, 'cat', 'cat.id = ucs.evaluation_category_id')
      .select('cat.name',        'category_name')
      .addSelect('ucs.score',    'score')
      .addSelect('ucs.confidence', 'confidence')
      .where('ucs.user_id = :userId', { userId })
      .andWhere('cat.job_type_id = :jobTypeId', { jobTypeId })
      .andWhere('cat.is_active = true')
      .getRawMany();

    if (categoryScores.length === 0) return { scoreMatch: 0, details: {} };

    const details: Record<string, number> = {};
    let totalWeight = 0;
    let weightedScore = 0;

    for (const row of categoryScores) {
      const score      = Number(row.score);
      const confidence = Number(row.confidence);
      const minRequired = minScores?.[row.category_name] ?? 0;

      // Si no llega al mínimo requerido, score es 0 para esa categoría
      const effectiveScore = score >= minRequired ? score : score * 0.5;

      details[row.category_name] = Math.round(score);
      weightedScore += effectiveScore * confidence;
      totalWeight   += confidence;
    }

    const scoreMatch = totalWeight > 0 ? (weightedScore / totalWeight) : 0;
    return { scoreMatch, details };
  }

  // ─── Distancia geográfica (fórmula de Haversine) ─────────────────────────────

  private calculateLocationMatch(
    profile: UserProfile,
    post:    JobPost,
  ): { locationMatch: number; distanceKm: number | null } {

    // Si alguno no tiene coordenadas, no penaliza pero tampoco suma
    if (
      profile.latitude  == null || profile.longitude == null ||
      post.latitude     == null || post.longitude    == null
    ) {
      return { locationMatch: 50, distanceKm: null };
    }

    const distanceKm = this.haversine(
      profile.latitude, profile.longitude,
      post.latitude,    post.longitude,
    );

    const radius = post.radius_km ?? DEFAULT_RADIUS_KM;

    if (distanceKm > radius) {
      return { locationMatch: 0, distanceKm };
    }

    // Dentro del radio: score lineal — más cerca, mejor
    const locationMatch = 100 * (1 - distanceKm / radius);
    return { locationMatch, distanceKm };
  }

  // ─── Salario ─────────────────────────────────────────────────────────────────

  private calculateSalaryMatch(profile: UserProfile, post: JobPost): boolean {
    // Si alguno no especifica salario, no hay incompatibilidad
    if (
      profile.salary_min == null ||
      post.salary_min    == null ||
      post.salary_max    == null
    ) return true;

    // Las divisas deben coincidir
    if (profile.currency && post.currency && profile.currency !== post.currency)
      return false;

    // El salario esperado del usuario debe estar dentro del rango del post
    return profile.salary_min <= post.salary_max;
  }

  // ─── Modalidad ───────────────────────────────────────────────────────────────

  private calculateModalityMatch(profile: UserProfile, post: JobPost): boolean {
    if (!profile.modality || !post.modality) return true;
    if (post.modality === 'hybrid') return true; // hybrid acepta cualquiera
    return profile.modality === post.modality;
  }

  // ─── Haversine ───────────────────────────────────────────────────────────────

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R    = 6371; // radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}