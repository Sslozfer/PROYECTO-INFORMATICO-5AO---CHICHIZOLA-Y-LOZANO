import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { Employment } from '../employments/employment.entity';
import { Company } from '../companies/company.entity';
import { UserProfile } from '../matching/user-profile.entity';
import { VoterReliability } from '../scoring/voter-reliability.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(UserCategoryScore)
    private categoryScoreRepo: Repository<UserCategoryScore>,

    @InjectRepository(EvaluationCategory)
    private categoryRepo: Repository<EvaluationCategory>,

    @InjectRepository(Employment)
    private employmentRepo: Repository<Employment>,

    @InjectRepository(Company)
    private companyRepo: Repository<Company>,

    @InjectRepository(UserProfile)
    private userProfileRepo: Repository<UserProfile>,

    @InjectRepository(VoterReliability)
    private reliabilityRepo: Repository<VoterReliability>,
  ) {}

  async create(data: Partial<User>) {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async findOne(id: number) {
    return this.userRepo.findOne({ where: { id } });
  }

  async lookupUser(query: string) {
    // Busca por ID exacto o nombre parcial, solo usuarios role='user'
    const byId = parseInt(query, 10);
    if (!isNaN(byId)) {
      const u = await this.userRepo.findOne({ where: { id: byId, role: 'user' }, select: ['id', 'name', 'identity_verified', 'performance_score'] });
      return u ? [u] : [];
    }
    return this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.identity_verified', 'u.performance_score'])
      .where('u.role = :role', { role: 'user' })
      .andWhere('LOWER(u.name) LIKE :q', { q: `%${query.toLowerCase()}%` })
      .limit(10)
      .getMany();
  }

  async updateOwnProfile(userId: number, data: { name?: string; email?: string }) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email;

    return this.userRepo.save(user);
  }

  async getRanking(jobTypeId?: number, categoryId?: number) {
    if (!jobTypeId) {
      return this.userRepo.find({
        select: ['id', 'name', 'performance_score'],
        where:  { role: 'user' },
        order:  { performance_score: 'DESC' },
        take:   50,
      });
    }

    // Ranking dentro de un rubro: promedio de los scores del usuario
    // en las subáreas (evaluation_categories) de ese job_type.
    // Filtrar por categoría específica (skill)
    if (categoryId) {
      return this.categoryScoreRepo
        .createQueryBuilder('ucs')
        .innerJoin(User, 'u', "u.id = ucs.user_id AND u.role = 'user'")
        .select('u.id',   'id')
        .addSelect('u.name', 'name')
        .addSelect('ucs.score', 'performance_score')
        .where('ucs.evaluation_category_id = :categoryId', { categoryId })
        .orderBy('ucs.score', 'DESC')
        .limit(50)
        .getRawMany()
        .then(rows => rows.map(r => ({
          id: Number(r.id),
          name: r.name,
          performance_score: Math.round(Number(r.performance_score) * 10) / 10,
        })));
    }

    return this.categoryScoreRepo
      .createQueryBuilder('ucs')
      .innerJoin(EvaluationCategory, 'cat', 'cat.id = ucs.evaluation_category_id')
      .innerJoin(User, 'u', "u.id = ucs.user_id AND u.role = 'user'")
      .select('u.id',   'id')
      .addSelect('u.name', 'name')
      .addSelect('AVG(ucs.score)', 'performance_score')
      .where('cat.job_type_id = :jobTypeId', { jobTypeId })
      .andWhere('cat.is_active = true')
      .groupBy('u.id')
      .addGroupBy('u.name')
      .orderBy('AVG(ucs.score)', 'DESC')
      .limit(50)
      .getRawMany()
      .then(rows => rows.map(r => ({
        id: Number(r.id),
        name: r.name,
        performance_score: Math.round(Number(r.performance_score) * 10) / 10,
      })));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERFIL PÚBLICO
  // Accesible por cualquiera — sin login
  // ─────────────────────────────────────────────────────────────────────────────

  async getPublicProfile(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Scores por categoría (públicos)
    const categoryScores = await this.categoryScoreRepo
      .createQueryBuilder('ucs')
      .innerJoin(EvaluationCategory, 'cat', 'cat.id = ucs.evaluation_category_id')
      .select('cat.name',        'category')
      .addSelect('ucs.score',    'score')
      .addSelect('ucs.confidence', 'confidence')
      .addSelect('ucs.vote_count', 'vote_count')
      .where('ucs.user_id = :userId', { userId })
      .andWhere('cat.is_active = true')
      .getRawMany();

    // Empleos verificados (solo los que tienen verification_level >= 1)
    const employments = await this.employmentRepo
      .createQueryBuilder('emp')
      .innerJoin(Company, 'co', 'co.id = emp.company_id')
      .select('co.name',              'company_name')
      .addSelect('emp.role',           'role')
      .addSelect('emp.start_date',     'start_date')
      .addSelect('emp.end_date',       'end_date')
      .addSelect('emp.verification_level', 'verification_level')
      .where('emp.user_id = :userId', { userId })
      .andWhere('emp.verification_level >= 1')
      .orderBy('emp.start_date', 'DESC')
      .getRawMany();

    return {
      id:                user.id,
      name:              user.name,
      performance_score: user.performance_score,
      identity_verified: user.identity_verified,
      category_scores:   categoryScores.map(s => ({
        category:    s.category,
        score:       Math.round(Number(s.score) * 10) / 10,
        confidence:  Math.round(Number(s.confidence) * 100),
        vote_count:  s.vote_count,
      })),
      employments: employments.map(e => ({
        company_name:       e.company_name,
        role:               e.role,
        start_date:         e.start_date,
        end_date:           e.end_date,
        verification_level: e.verification_level,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERFIL PARA EMPRESAS
  // Agrega zona y salario si el usuario está buscando empleo activamente
  // ─────────────────────────────────────────────────────────────────────────────

  async getCompanyProfile(userId: number) {
    const base = await this.getPublicProfile(userId);

    // Solo exponer matching profile si está buscando activamente
    const matchingProfiles = await this.userProfileRepo.find({
      where: { user_id: userId, is_active: true },
    });

    const jobSearch = matchingProfiles.map(p => ({
      job_type_id:    p.job_type_id,
      location_label: p.location_label,
      salary_min:     p.salary_min,
      salary_max:     p.salary_max,
      currency:       p.currency,
      modality:       p.modality,
    }));

    return {
      ...base,
      job_search: jobSearch,  // vacío si no está buscando
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERFIL ADMIN
  // Agrega reliability y fraud score
  // ─────────────────────────────────────────────────────────────────────────────

  async getAdminProfile(userId: number) {
    const base = await this.getCompanyProfile(userId);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const reliability = await this.reliabilityRepo.findOne({ where: { user_id: userId } });

    return {
      ...base,
      fraud_score:      user!.fraud_score,
      is_blocked:       user!.is_blocked,
      is_shadow_banned: user!.is_shadow_banned,
      global_trust_score: user!.global_trust_score,
      reliability:      reliability?.reliability      ?? 1.0,
      deviation_streak: reliability?.deviation_streak ?? 0,
      total_votes_cast: reliability?.total_votes_cast ?? 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERFIL PROPIO
  // El usuario ve su propio perfil completo (sin fraud/reliability)
  // ─────────────────────────────────────────────────────────────────────────────

  async getOwnProfile(userId: number) {
    const base    = await this.getCompanyProfile(userId);
    const user    = await this.userRepo.findOne({ where: { id: userId } });

    return {
      ...base,
      email: user!.email,
      role:  user!.role,
    };
  }
}