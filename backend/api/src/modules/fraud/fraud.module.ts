import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudFlag } from './fraud-flag.entity';
import { FraudService } from './fraud.service';
import { Rating } from '../ratings/ratings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FraudFlag,
      Rating,
    ]),
  ],
  providers: [FraudService],
  exports:   [FraudService],
})
export class FraudModule {}