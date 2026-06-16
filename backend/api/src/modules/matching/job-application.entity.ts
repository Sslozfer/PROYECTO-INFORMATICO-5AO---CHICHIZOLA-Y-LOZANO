import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('job_applications')
export class JobApplication {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  job_post_id: number;

  @Column()
  user_id: number;

  // 'manual' | 'semi_auto' | 'auto'
  @Column({ type: 'text' })
  mode: string;

  // 'pending' | 'auto_accepted' | 'accepted' | 'rejected_by_candidate' | 'rejected_by_company' | 'withdrawn'
  @Column({ type: 'text', default: 'pending' })
  status: string;

  // Score de compatibilidad en el momento de la aplicación
  @Column({ type: 'float', nullable: true })
  compatibility_score: number | null;

  // Condiciones que se evaluaron (snapshot)
  @Column({ type: 'jsonb', nullable: true })
  conditions_snapshot: Record<string, any> | null;

  // Cuándo expira la oferta automática para que el candidato decida
  @Column({ type: 'timestamp', nullable: true })
  auto_offer_expires_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}