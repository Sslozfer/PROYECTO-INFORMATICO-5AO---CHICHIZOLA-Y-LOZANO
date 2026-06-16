import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { Rating } from './ratings.entity';
import { User } from '../users/users.entity';
import { RatingWeight } from '../scoring/rating-weight.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { FraudModule } from '../fraud/fraud.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rating, User, RatingWeight, EvaluationCategory]),
    FraudModule,
    ScoringModule,
  ],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}