import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Employment } from './employment.entity';
import { EmploymentsService } from './employments.service';
import { EmploymentsController } from './employments.controller';
import { Company } from '../companies/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employment, Company]),
    MulterModule.register({ dest: './uploads' }),
  ],
  providers:   [EmploymentsService],
  controllers: [EmploymentsController],
  exports:     [EmploymentsService],
})
export class EmploymentsModule {}