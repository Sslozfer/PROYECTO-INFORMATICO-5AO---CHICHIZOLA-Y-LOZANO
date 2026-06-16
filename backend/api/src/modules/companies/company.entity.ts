import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  domain: string | null;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'float', default: 0 })
  company_score: number;

  @Column({ type: 'float', default: 0 })
  internal_reputation: number;

  @Column({ type: 'float', default: 0 })
  external_perception: number;

  @Column({ type: 'text', nullable: true })
  contact_email: string | null;

  @CreateDateColumn()
  created_at: Date;
}