import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('job_posts')
export class JobPost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  company_id: number;

  @Column()
  job_type_id: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Ubicación
  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ type: 'text', nullable: true })
  location_label: string | null;

  // Salario
  @Column({ type: 'int', nullable: true })
  salary_min: number | null;

  @Column({ type: 'int', nullable: true })
  salary_max: number | null;

  @Column({ type: 'text', nullable: true })
  currency: string | null;

  // 'remote' | 'onsite' | 'hybrid'
  @Column({ type: 'text', nullable: true })
  modality: string | null;

  // Score mínimo requerido por categoría para el matching
  @Column({ type: 'jsonb', nullable: true })
  min_category_scores: Record<string, number> | null;

  @Column({ type: 'int', default: 50 })
  radius_km: number;

  // ─── Modo de contratación ──────────────────────────────────────────────────
  // 'manual' | 'semi_auto' | 'auto'
  @Column({ type: 'text', default: 'manual' })
  hiring_mode: string;

  // Condiciones para auto-aceptación (solo aplica si hiring_mode = 'auto' o 'semi_auto')
  @Column({ type: 'float', nullable: true })
  auto_min_compatibility: number | null;   // ej: 75 → mínimo 75% de compatibilidad

  @Column({ type: 'float', nullable: true })
  auto_min_category_score: number | null;  // ej: 70 → todas las categorías >= 70

  @Column({ type: 'float', nullable: true })
  auto_max_distance_km: number | null;     // ej: 30 → máximo 30km

  @Column({ default: false })
  auto_require_identity: boolean;          // requiere identity_verified = true

  // Ventana para que el candidato acepte/rechace la oferta automática (horas)
  @Column({ type: 'int', default: 48 })
  auto_offer_ttl_hours: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}