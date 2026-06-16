import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Employment } from './employment.entity';
import { Company } from '../companies/company.entity';
import { CreateEmploymentDto, VerifyByEmailDto } from './employments.dto';
import * as crypto from 'crypto';

const CONFIRM_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class EmploymentsService {
  constructor(
    @InjectRepository(Employment)
    private employmentRepo: Repository<Employment>,

    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
  ) {}

  // ─── Crear empleo ─────────────────────────────────────────────────────────────

  async create(userId: number, dto: CreateEmploymentDto): Promise<Employment> {
    const company = await this.companyRepo.findOne({ where: { id: dto.company_id } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    // No puede tener dos empleos activos (sin end_date) en la misma empresa
    const existing = await this.employmentRepo.findOne({
      where: { user_id: userId, company_id: dto.company_id, end_date: IsNull() },
    });
    if (existing)
      throw new BadRequestException('Ya tenés un empleo activo en esta empresa');

    const employment = this.employmentRepo.create({
      user_id:            userId,
      company_id:         dto.company_id,
      role:               dto.role ?? null,
      start_date:         dto.start_date ? new Date(dto.start_date) : null,
      end_date:           dto.end_date   ? new Date(dto.end_date)   : null,
      verification_level: 0,
    });

    return this.employmentRepo.save(employment) as Promise<Employment>;
  }

  // ─── Verificación por email corporativo ──────────────────────────────────────

  async verifyByEmail(userId: number, dto: VerifyByEmailDto): Promise<Employment> {
    const employment = await this.findEmploymentForUser(userId, dto.employment_id);
    const company    = await this.companyRepo.findOne({ where: { id: employment.company_id } });

    if (!company?.domain)
      throw new BadRequestException('La empresa no tiene dominio registrado');

    const emailDomain   = dto.corporate_email.split('@')[1]?.toLowerCase();
    const companyDomain = company.domain.toLowerCase().replace(/^www\./, '');

    if (emailDomain !== companyDomain)
      throw new BadRequestException(
        `El email no pertenece al dominio de la empresa (${company.domain})`,
      );

    employment.verification_level = Math.max(employment.verification_level, 1);
    employment.verified_by        = 'system';
    employment.proof_type         = 'email';

    return this.employmentRepo.save(employment) as Promise<Employment>;
  }

  // ─── Verificación por documento ──────────────────────────────────────────────

  async verifyByDocument(
    userId:       number,
    employmentId: number,
    fileUrl:      string,
    proofType:    'doc' | 'contract',
  ): Promise<Employment> {
    const employment = await this.findEmploymentForUser(userId, employmentId);

    employment.verification_level = Math.max(employment.verification_level, 3);
    employment.verified_by        = 'system';
    employment.proof_type         = proofType;
    employment.proof_url          = fileUrl;

    return this.employmentRepo.save(employment) as Promise<Employment>;
  }

  // ─── Confirmación por empresa — paso 1: generar token ────────────────────────

  async requestCompanyConfirmation(
    userId:       number,
    employmentId: number,
  ): Promise<{ token: string; expires_at: Date }> {
    const employment = await this.findEmploymentForUser(userId, employmentId);

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CONFIRM_TOKEN_TTL_MS);

    employment.confirm_token         = token;
    employment.confirm_token_expires = expiresAt;

    await this.employmentRepo.save(employment);

    // TODO: enviar token por email al contacto de la empresa
    return { token, expires_at: expiresAt };
  }

  // ─── Confirmación por empresa — paso 2: empresa usa el token ─────────────────

  async confirmByCompany(token: string): Promise<Employment> {
    const employment = await this.employmentRepo.findOne({
      where: { confirm_token: token },
    });

    if (!employment)
      throw new NotFoundException('Token inválido');

    if (employment.confirm_token_expires && new Date() > employment.confirm_token_expires)
      throw new BadRequestException('El token expiró');

    employment.verification_level   = 4;
    employment.verified_by          = 'company';
    employment.proof_type           = 'company_confirm';
    employment.company_confirmed    = true;
    employment.confirm_token        = null;
    employment.confirm_token_expires = null;

    return this.employmentRepo.save(employment) as Promise<Employment>;
  }

  // ─── Historial de empleos ────────────────────────────────────────────────────

  async getByUser(userId: number): Promise<Employment[]> {
    return this.employmentRepo.find({
      where: { user_id: userId },
      order: { start_date: 'DESC' },
    });
  }

  // ─── Helper privado ──────────────────────────────────────────────────────────

  private async findEmploymentForUser(
    userId:       number,
    employmentId: number,
  ): Promise<Employment> {
    const employment = await this.employmentRepo.findOne({
      where: { id: employmentId, user_id: userId },
    });
    if (!employment)
      throw new NotFoundException('Empleo no encontrado o no pertenece a este usuario');
    return employment;
  }
}