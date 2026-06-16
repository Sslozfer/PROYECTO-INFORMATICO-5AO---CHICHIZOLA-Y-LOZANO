import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FraudFlag } from '../fraud/fraud-flag.entity';
import { User } from '../users/users.entity';
import { Rating } from '../ratings/ratings.entity';
import { VoterReliability } from '../scoring/voter-reliability.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FraudFlag,
      User,
      Rating,
      VoterReliability,
      UserCategoryScore,
      EvaluationCategory,
    ]),
  ],
  controllers: [AdminController],
  providers:   [AdminService],
})
export class AdminModule {}