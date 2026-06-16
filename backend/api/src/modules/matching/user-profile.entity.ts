import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn()
  user_id: number;

  @PrimaryColumn()
  job_type_id: number;

  // Ubicación
  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ type: 'text', nullable: true })
  location_label: string | null; // ej: "Buenos Aires, Argentina"

  // Preferencias laborales
  @Column({ type: 'int', nullable: true })
  salary_min: number | null; // salario esperado mínimo

  @Column({ type: 'int', nullable: true })
  salary_max: number | null;

  @Column({ type: 'text', nullable: true })
  currency: string | null; // 'ARS' | 'USD' | etc.

  // 'remote' | 'onsite' | 'hybrid'
  @Column({ type: 'text', nullable: true })
  modality: string | null;

  @Column({ default: true })
  is_active: boolean;

  // Skills seleccionadas por el usuario (array de evaluation_category ids)
  @Column({ type: 'jsonb', default: '[]' })
  skill_category_ids: number[]; // si está buscando trabajo activamente

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}