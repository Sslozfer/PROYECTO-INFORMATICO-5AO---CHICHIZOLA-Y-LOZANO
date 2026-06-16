import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('evaluation_categories')
export class EvaluationCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  job_type_id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'float', default: 0 })
  employer_weight: number;

  @Column({ type: 'float', default: 0 })
  peer_weight: number;

  @Column({ type: 'float', default: 0 })
  client_weight: number;

  @Column({ type: 'float', default: 1.0 })
  category_weight: number;

  @Column({ default: false })
  suggested_by_ai: boolean;

  @Column({ default: false })
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}