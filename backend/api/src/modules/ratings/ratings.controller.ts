import { Controller, Get, Post, Body, Param, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsInt, Min, Max, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateRatingDto {
  @IsInt()
  to_user_id: number;

  @IsInt()
  evaluation_category_id: number;

  @IsInt()
  @Min(1)
  @Max(100)
  score: number;

  @IsIn(['employer', 'peer', 'client'])
  source_type: 'employer' | 'peer' | 'client';

  @IsOptional() @IsString()
  context_type?: string;

  @IsOptional() @IsString()
  interaction_frequency?: string;

  @IsOptional() @IsInt()
  duration_months?: number;

  @IsOptional() @IsInt()
  company_id?: number;

  @IsOptional() @IsInt()
  employment_id?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  create(@Body() dto: CreateRatingDto, @Req() req) {
    return this.ratingsService.create({ ...dto, from_user_id: req.user.id });
  }

  @Get('received')
  getReceived(@Req() req) {
    return this.ratingsService.getReceived(req.user.id);
  }

  @Get('given')
  getGiven(@Req() req) {
    return this.ratingsService.getGiven(req.user.id);
  }

  @Get('evaluable/:toUserId')
  getEvaluable(@Param('toUserId', ParseIntPipe) toUserId: number, @Req() req) {
    return this.ratingsService.getEvaluableCategories(req.user.id, toUserId);
  }
}