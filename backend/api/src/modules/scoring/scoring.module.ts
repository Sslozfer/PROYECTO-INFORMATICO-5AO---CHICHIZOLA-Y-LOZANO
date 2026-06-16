import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { User } from '../users/users.entity';
import { UserCategoryScore } from './user-category-score.entity';
import { VoterReliability } from './voter-reliability.entity';
import { ScoreChangeLog } from './score-change-log.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserCategoryScore,
      VoterReliability,
      ScoreChangeLog,
      EvaluationCategory,
    ]),
  ],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}