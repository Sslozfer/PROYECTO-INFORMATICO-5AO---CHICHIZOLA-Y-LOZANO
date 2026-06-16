import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EvaluationCategory } from './evaluation-category.entity';
import { JobType } from './job-type.entity';
import { CreateJobTypeDto, ApproveCategoryDto } from './categories.dto';

export interface CategorySuggestion {
  name:            string;
  description:     string;
  employer_weight: number;
  peer_weight:     number;
  client_weight:   number;
  category_weight: number;
  rationale:       string;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(EvaluationCategory)
    private categoryRepo: Repository<EvaluationCategory>,

    @InjectRepository(JobType)
    private jobTypeRepo: Repository<JobType>,

    private config: ConfigService,
  ) {}

  // ─── Job types ────────────────────────────────────────────────────────────────

  async createJobType(dto: CreateJobTypeDto): Promise<JobType> {
    const existing = await this.jobTypeRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new BadRequestException('Ya existe un job type con ese nombre');

    return this.jobTypeRepo.save(this.jobTypeRepo.create({ ...dto, is_active: false }));
  }

  async activateJobType(jobTypeId: number): Promise<JobType> {
    const jobType = await this.jobTypeRepo.findOne({ where: { id: jobTypeId } });
    if (!jobType) throw new NotFoundException('Job type no encontrado');

    const activeCategories = await this.categoryRepo.count({
      where: { job_type_id: jobTypeId, is_active: true },
    });
    if (activeCategories === 0)
      throw new BadRequestException('El job type necesita al menos una categoría activa');

    jobType.is_active = true;
    return this.jobTypeRepo.save(jobType);
  }

  async getJobTypes(onlyActive = false): Promise<JobType[]> {
    return this.jobTypeRepo.find({
      where: onlyActive ? { is_active: true } : {},
      order: { name: 'ASC' },
    });
  }

  // ─── Sugerencia por IA ────────────────────────────────────────────────────────

  async suggestCategories(jobTypeId: number): Promise<EvaluationCategory[]> {
    const jobType = await this.jobTypeRepo.findOne({ where: { id: jobTypeId } });
    if (!jobType) throw new NotFoundException('Job type no encontrado');

    const prompt = `
Sos un experto en evaluación de desempeño laboral.
Tu tarea es sugerir categorías de evaluación para el tipo de trabajo: "${jobType.name}".
${jobType.description ? `Descripción: ${jobType.description}` : ''}

Para cada categoría definí:
- name: nombre corto y claro
- description: qué se evalúa exactamente
- employer_weight: peso del empleador (0–10)
- peer_weight: peso de los pares (0–10)
- client_weight: peso de los clientes/usuarios (0–10)
- category_weight: importancia en el score global (0–10)
- rationale: por qué es relevante para este trabajo

Distribuí los pesos según el contexto:
- Mucho contacto con el público → client_weight alto
- Trabajo técnico entre pares → peer_weight alto
- Responsabilidades de gestión → employer_weight alto

Respondé SOLO con un array JSON válido, sin texto adicional ni bloques de código.
Sugerí entre 5 y 10 categorías.
    `.trim();

    let suggestions: CategorySuggestion[] = [];

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('ANTHROPIC_API_KEY no está configurada');
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages:   [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en API de Anthropic: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('')
        .replace(/```json|```/g, '')
        .trim();

      suggestions = JSON.parse(text);
    } catch (err) {
      throw new BadRequestException('Error al generar sugerencias con IA: ' + err.message);
    }

    return Promise.all(
      suggestions.map((s) =>
        this.categoryRepo.save(
          this.categoryRepo.create({
            job_type_id:     jobTypeId,
            name:            s.name,
            description:     s.description,
            employer_weight: s.employer_weight,
            peer_weight:     s.peer_weight,
            client_weight:   s.client_weight,
            category_weight: s.category_weight,
            suggested_by_ai: true,
            is_active:       false,
          }),
        ),
      ),
    );
  }

  // ─── Aprobación (admin) ───────────────────────────────────────────────────────

  async approveCategory(categoryId: number, dto: ApproveCategoryDto = new ApproveCategoryDto()): Promise<EvaluationCategory> {
    const category = await this.categoryRepo.findOne({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    if (category.is_active) throw new BadRequestException('La categoría ya está activa');

    if (dto.name)                         category.name            = dto.name;
    if (dto.description)                  category.description     = dto.description;
    if (dto.employer_weight !== undefined) category.employer_weight = dto.employer_weight;
    if (dto.peer_weight     !== undefined) category.peer_weight     = dto.peer_weight;
    if (dto.client_weight   !== undefined) category.client_weight   = dto.client_weight;
    if (dto.category_weight !== undefined) category.category_weight = dto.category_weight;

    const totalWeight =
      category.employer_weight + category.peer_weight + category.client_weight;
    if (totalWeight === 0)
      throw new BadRequestException('Al menos una fuente debe tener peso > 0');

    category.is_active = true;
    return this.categoryRepo.save(category);
  }

  async rejectCategory(categoryId: number): Promise<void> {
    const category = await this.categoryRepo.findOne({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    await this.categoryRepo.remove(category);
  }

  // ─── Consultas ────────────────────────────────────────────────────────────────

  async getPendingCategories(jobTypeId?: number): Promise<EvaluationCategory[]> {
    const where: any = { is_active: false };
    if (jobTypeId) where.job_type_id = jobTypeId;
    return this.categoryRepo.find({ where, order: { created_at: 'DESC' } });
  }

  async getActiveCategories(jobTypeId: number): Promise<EvaluationCategory[]> {
    return this.categoryRepo.find({
      where: { job_type_id: jobTypeId, is_active: true },
      order: { category_weight: 'DESC' },
    });
  }

  async getAllActiveCategories(): Promise<EvaluationCategory[]> {
    return this.categoryRepo.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  async createCategoryManually(data: {
    job_type_id:     number;
    name:            string;
    description?:    string;
    employer_weight: number;
    peer_weight:     number;
    client_weight:   number;
    category_weight: number;
  }): Promise<EvaluationCategory> {
    const totalWeight = data.employer_weight + data.peer_weight + data.client_weight;
    if (totalWeight === 0)
      throw new BadRequestException('Al menos una fuente debe tener peso > 0');

    return this.categoryRepo.save(
      this.categoryRepo.create({ ...data, suggested_by_ai: false, is_active: false }),
    );
  }
}