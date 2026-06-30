import { Entity, PrimaryColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { Company } from './company.entity';
import { JobType } from '../categories/job-type.entity';

@Entity('company_job_types')
export class CompanyJobType {
  @PrimaryColumn()
  company_id: number;

  @PrimaryColumn()
  job_type_id: number;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => JobType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_type_id' })
  job_type: JobType;
}