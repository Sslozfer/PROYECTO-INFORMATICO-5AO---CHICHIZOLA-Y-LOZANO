import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text', name: 'password_hash' })
  password_hash: string;

  // 'user' | 'company' | 'admin'
  @Column({ type: 'text', default: 'user' })
  role: string;

  // ─── Confianza como votante ───────────────────────────────────────────────
  @Column({ type: 'float', default: 1.0 })
  global_trust_score: number;

  // ─── Rendimiento laboral ─────────────────────────────────────────────────
  @Column({ type: 'float', default: 0 })
  performance_score: number;

  @Column({ type: 'float', default: 0 })
  perf_weighted_sum: number;

  @Column({ type: 'float', default: 0 })
  perf_weight_sum: number;

  // ─── Fraude ──────────────────────────────────────────────────────────────
  @Column({ type: 'float', default: 0 })
  fraud_score: number;

  @Column({ default: false })
  is_blocked: boolean;

  @Column({ default: false })
  is_shadow_banned: boolean;

  // ─── Verificación ────────────────────────────────────────────────────────
  @Column({ default: false })
  identity_verified: boolean;

  @Column({ nullable: true })
  company_id: number;

  @CreateDateColumn()
  created_at: Date;
}