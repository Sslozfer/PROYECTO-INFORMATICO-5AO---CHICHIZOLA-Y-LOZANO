import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fraud_flags')
export class FraudFlag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  rating_id: number;

  @Column()
  type: string;

  @Column({ type: 'float' })
  severity: number;

  @Column()
  detected_by: string;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;
}