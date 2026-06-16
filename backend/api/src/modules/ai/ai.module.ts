import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { User } from '../users/users.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { FraudFlag } from '../fraud/fraud-flag.entity';
import { Rating } from '../ratings/ratings.entity';
import { VoterReliability } from '../scoring/voter-reliability.entity';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserCategoryScore,
      EvaluationCategory,
      FraudFlag,
      Rating,
      VoterReliability,
    ]),
    MatchingModule,
  ],
  providers:   [AiService],
  controllers: [AiController],
  exports:     [AiService],
})
export class AiModule {}