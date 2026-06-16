import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
 
@Entity('employments')
export class Employment {
  @PrimaryGeneratedColumn()
  id: number;
 
  @Column()
  user_id: number;
 
  @Column()
  company_id: number;
 
  @Column({ type: 'text', nullable: true })
  role: string | null;
 
  @Column({ type: 'date', nullable: true })
  start_date: Date | null;
 
  @Column({ type: 'date', nullable: true })
  end_date: Date | null;
 
  @Column({ default: 0 })
  verification_level: number;
 
  @Column({ type: 'text', nullable: true })
  verified_by: string | null;
 
  @Column({ type: 'text', nullable: true })
  proof_type: string | null;
 
  @Column({ type: 'text', nullable: true })
  proof_url: string | null;
 
  @Column({ type: 'text', nullable: true })
  confirm_token: string | null;
 
  @Column({ type: 'timestamp', nullable: true })
  confirm_token_expires: Date | null;
 
  @Column({ default: false })
  company_confirmed: boolean;
 
  @CreateDateColumn()
  created_at: Date;
}