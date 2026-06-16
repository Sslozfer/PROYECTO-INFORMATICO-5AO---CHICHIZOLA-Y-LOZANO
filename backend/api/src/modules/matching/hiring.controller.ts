import {
  Controller, Post, Get, Patch, Param,
  Body, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { HiringService } from './hiring.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class RespondToOfferDto {
  @IsBoolean()
  accept: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReviewApplicationDto {
  @IsBoolean()
  accept: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('hiring')
export class HiringController {
  constructor(private readonly hiringService: HiringService) {}

  // ─── Candidato ────────────────────────────────────────────────────────────────

  @Post('apply/:jobPostId')
  apply(@Param('jobPostId', ParseIntPipe) jobPostId: number, @Req() req) {
    return this.hiringService.apply(req.user.id, jobPostId);
  }

  @Get('my-applications')
  getMyApplications(@Req() req) {
    return this.hiringService.getMyApplications(req.user.id);
  }

  @Patch('applications/:id/respond')
  respondToOffer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondToOfferDto,
    @Req() req,
  ) {
    return this.hiringService.respondToOffer(req.user.id, id, dto.accept, dto.reason);
  }

  @Patch('applications/:id/withdraw')
  withdraw(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.hiringService.withdraw(req.user.id, id);
  }

  // ─── Empresa ──────────────────────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles('company', 'admin')
  @Get('posts/:jobPostId/applications')
  getApplicationsForPost(
    @Param('jobPostId', ParseIntPipe) jobPostId: number,
    @Req() req,
  ) {
    return this.hiringService.getApplicationsForPost(req.user.id, jobPostId);
  }

  @UseGuards(RolesGuard)
  @Roles('company', 'admin')
  @Patch('applications/:id/review')
  reviewApplication(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewApplicationDto,
    @Req() req,
  ) {
    return this.hiringService.reviewApplication(req.user.id, id, dto.accept, dto.reason);
  }
}