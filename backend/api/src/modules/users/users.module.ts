import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { Employment } from '../employments/employment.entity';
import { Company } from '../companies/company.entity';
import { UserProfile } from '../matching/user-profile.entity';
import { VoterReliability } from '../scoring/voter-reliability.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserCategoryScore,
      EvaluationCategory,
      Employment,
      Company,
      UserProfile,
      VoterReliability,
    ]),
  ],
  providers:   [UsersService],
  controllers: [UsersController],
  exports:     [UsersService],
})
export class UsersModule {}