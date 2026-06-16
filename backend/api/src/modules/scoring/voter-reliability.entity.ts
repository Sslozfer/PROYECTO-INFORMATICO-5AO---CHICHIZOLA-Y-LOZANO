import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('voter_reliability')
export class VoterReliability {
  @PrimaryColumn()
  user_id: number;

  @Column({ type: 'float', default: 1.0 })
  reliability: number;

  @Column({ default: 0 })
  deviation_streak: number;

  @Column({ default: 0 })
  recovery_streak: number;

  @Column({ default: 0 })
  total_votes_cast: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_updated: Date;
}