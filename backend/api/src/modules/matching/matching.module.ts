import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { HiringService } from './hiring.service';
import { HiringController } from './hiring.controller';
import { JobPost } from './job-post.entity';
import { JobApplication } from './job-application.entity';
import { UserProfile } from './user-profile.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { User } from '../users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobPost,
      JobApplication,
      UserProfile,
      UserCategoryScore,
      EvaluationCategory,
      User,
    ]),
  ],
  providers:   [MatchingService, HiringService],
  controllers: [MatchingController, HiringController],
  exports:     [MatchingService, HiringService],
})
export class MatchingModule {}