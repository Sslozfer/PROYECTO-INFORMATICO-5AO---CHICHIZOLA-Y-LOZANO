import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Company } from './company.entity';
import { CompanyJobType } from './company-job-type.entity';
import { JobType } from '../categories/job-type.entity';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,

    @InjectRepository(CompanyJobType)
    private cjtRepo: Repository<CompanyJobType>,

    @InjectRepository(JobType)
    private jobTypeRepo: Repository<JobType>,
  ) {}

  // ─── CRUD básico ─────────────────────────────────────────────────────────────

  async create(dto: CreateCompanyDto): Promise<Company> {
    if (dto.domain) {
      const existing = await this.companyRepo.findOne({ where: { domain: dto.domain } });
      if (existing) throw new BadRequestException('Ya existe una empresa con ese dominio');
    }
    return this.companyRepo.save(
      this.companyRepo.create({ ...dto, verified: false }),
    ) as Promise<Company>;
  }

  async findOne(id: number): Promise<Company & { job_types: JobType[] }> {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    const cjts = await this.cjtRepo.find({ where: { company_id: id } });
    const jobTypes = cjts.length
      ? await this.jobTypeRepo.find({ where: { id: In(cjts.map(c => c.job_type_id)) } })
      : [];
    return { ...company, job_types: jobTypes };
  }

  async findAll(jobTypeId?: number): Promise<(Company & { job_types: JobType[] })[]> {
    let companyIds: number[] | null = null;
    if (jobTypeId) {
      const cjts = await this.cjtRepo.find({ where: { job_type_id: jobTypeId } });
      companyIds = cjts.map(c => c.company_id);
      if (companyIds.length === 0) return [];
    }

    const companies = companyIds !== null
      ? await this.companyRepo.find({ where: { id: In(companyIds) }, order: { company_score: 'DESC' } })
      : await this.companyRepo.find({ order: { company_score: 'DESC' } });

    // Enriquecer con job_types
    const allCjts = await this.cjtRepo.find({
      where: { company_id: In(companies.map(c => c.id)) },
    });
    const allJobTypeIds = [...new Set(allCjts.map(c => c.job_type_id))];
    const allJobTypes = allJobTypeIds.length
      ? await this.jobTypeRepo.find({ where: { id: In(allJobTypeIds) } })
      : [];
    const jtMap = new Map(allJobTypes.map(jt => [jt.id, jt]));

    return companies.map(co => ({
      ...co,
      job_types: allCjts
        .filter(c => c.company_id === co.id)
        .map(c => jtMap.get(c.job_type_id)!)
        .filter(Boolean),
    }));
  }

  async update(id: number, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    if (dto.domain && dto.domain !== company.domain) {
      const existing = await this.companyRepo.findOne({ where: { domain: dto.domain } });
      if (existing) throw new BadRequestException('Ya existe una empresa con ese dominio');
      company.verified = false;
    }
    Object.assign(company, dto);
    return this.companyRepo.save(company) as Promise<Company>;
  }

  // ─── Áreas (job_types) de la empresa ─────────────────────────────────────────

  async getJobTypes(companyId: number): Promise<JobType[]> {
    const cjts = await this.cjtRepo.find({ where: { company_id: companyId } });
    if (!cjts.length) return [];
    return this.jobTypeRepo.find({ where: { id: In(cjts.map(c => c.job_type_id)) } });
  }

  async setJobTypes(companyId: number, jobTypeIds: number[]): Promise<JobType[]> {
    // Validar que todos existan
    if (jobTypeIds.length) {
      const found = await this.jobTypeRepo.find({ where: { id: In(jobTypeIds) } });
      if (found.length !== jobTypeIds.length)
        throw new BadRequestException('Uno o más rubros no existen');
    }
    // Reemplazar
    await this.cjtRepo.delete({ company_id: companyId });
    if (jobTypeIds.length) {
      await this.cjtRepo.save(
        jobTypeIds.map(jt => this.cjtRepo.create({ company_id: companyId, job_type_id: jt })),
      );
    }
    return this.getJobTypes(companyId);
  }

  async setMyJobTypes(userId: number, jobTypeIds: number[]): Promise<JobType[]> {
    const user = await this.companyRepo.manager
      .getRepository('User')
      .findOne({ where: { id: userId } }) as any;
    if (!user?.company_id) throw new NotFoundException('No tenés una empresa asociada');
    return this.setJobTypes(user.company_id, jobTypeIds);
  }

  async updateMyCompany(userId: number, dto: UpdateCompanyDto): Promise<Company> {
    const user = await this.companyRepo.manager
      .getRepository('User')
      .findOne({ where: { id: userId } }) as any;
    if (!user?.company_id) throw new NotFoundException('No tenés una empresa asociada');
    return this.update(user.company_id, dto);
  }

  async getMyCompany(userId: number): Promise<(Company & { job_types: JobType[] }) | null> {
    const user = await this.companyRepo.manager
      .getRepository('User')
      .findOne({ where: { id: userId } }) as any;
    if (!user || !user.company_id) return null;
    return this.findOne(user.company_id);
  }

  // ─── Verificación de dominio (admin) ─────────────────────────────────────────

  async verifyDomain(id: number): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    if (!company.domain) throw new BadRequestException('La empresa no tiene dominio registrado');
    company.verified = true;
    return this.companyRepo.save(company) as Promise<Company>;
  }

  async findByDomain(domain: string): Promise<Company | null> {
    const normalized = domain.toLowerCase().replace(/^www\./, '');
    return this.companyRepo.findOne({ where: { domain: normalized } });
  }
}