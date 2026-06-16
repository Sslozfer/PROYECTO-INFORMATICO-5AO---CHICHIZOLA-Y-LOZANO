import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { CompanyJobType } from './company-job-type.entity';
import { JobType } from '../categories/job-type.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Company, CompanyJobType, JobType])],
  providers:   [CompaniesService],
  controllers: [CompaniesController],
  exports:     [CompaniesService],
})
export class CompaniesModule {}
