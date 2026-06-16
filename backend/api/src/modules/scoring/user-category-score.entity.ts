import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('user_category_scores')
export class UserCategoryScore {
  @PrimaryColumn()
  user_id: number;

  @PrimaryColumn()
  evaluation_category_id: number;

  @Column({ type: 'float', default: 0 })
  score: number;

  @Column({ type: 'float', default: 0 })
  confidence: number;

  @Column({ default: 0 })
  vote_count: number;

  @Column({ type: 'float', default: 0 })
  employer_weighted_sum: number;

  @Column({ type: 'float', default: 0 })
  employer_weight_sum: number;

  @Column({ type: 'float', default: 0 })
  peer_weighted_sum: number;

  @Column({ type: 'float', default: 0 })
  peer_weight_sum: number;

  @Column({ type: 'float', default: 0 })
  client_weighted_sum: number;

  @Column({ type: 'float', default: 0 })
  client_weight_sum: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_updated: Date;
}