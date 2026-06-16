import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('rating_weights')
export class RatingWeight {
  @PrimaryColumn()
  rating_id: number;

  @Column({ type: 'float', nullable: true })
  source_weight: number;

  @Column({ type: 'float', nullable: true })
  trust_weight: number;

  @Column({ type: 'float', nullable: true })
  reliability_weight: number;

  @Column({ type: 'float', nullable: true })
  context_weight: number;

  @Column({ type: 'float', nullable: true })
  time_weight: number;

  @Column({ type: 'float', nullable: true })
  anomaly_weight: number;

  @Column({ type: 'float', nullable: true })
  final_weight: number;
}