import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('score_change_logs')
export class ScoreChangeLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  field: string;

  @Column({ type: 'float' })
  delta: number;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  created_at: Date;
}