import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  from_user_id: number;

  @Column()
  to_user_id: number;

  @Column({ nullable: true })
  company_id: number;

  @Column({ nullable: true })
  employment_id: number;

  @Column()
  evaluation_category_id: number;

  @Column()
  score: number;

  @Column()
  source_type: string;

  @Column({ nullable: true })
  context_type: string;

  @Column({ nullable: true })
  interaction_frequency: string;

  @Column({ nullable: true })
  duration_months: number;

  @Column({ default: false })
  verified_relationship: boolean;

  @Column({ default: true })
  is_anonymous: boolean;

  @CreateDateColumn()
  created_at: Date;
}