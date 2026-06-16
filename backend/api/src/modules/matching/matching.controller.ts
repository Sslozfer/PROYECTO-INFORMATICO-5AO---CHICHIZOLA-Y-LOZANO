import {
  Controller, Get, Post, Put, Param,
  Body, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { MatchingService } from './matching.service';
import { UpsertUserProfileDto, CreateJobPostDto } from './matching.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from './user-profile.entity';
import { JobPost } from './job-post.entity';

@Controller('matching')
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,

    @InjectRepository(UserProfile)
    private userProfileRepo: Repository<UserProfile>,

    @InjectRepository(JobPost)
    private jobPostRepo: Repository<JobPost>,
  ) {}

  // ─── Perfil de búsqueda del usuario ──────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  @Put('profile')
  async upsertProfile(@Body() dto: UpsertUserProfileDto, @Req() req) {
    const existing = await this.userProfileRepo.findOne({
      where: { user_id: req.user.id, job_type_id: dto.job_type_id },
    });

    const profile = existing
      ? Object.assign(existing, { ...dto, updated_at: new Date() })
      : this.userProfileRepo.create({ ...dto, user_id: req.user.id, is_active: true });

    return this.userProfileRepo.save(profile);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/:jobTypeId')
  getProfile(@Param('jobTypeId', ParseIntPipe) jobTypeId: number, @Req() req) {
    return this.userProfileRepo.findOne({
      where: { user_id: req.user.id, job_type_id: jobTypeId },
    });
  }

  // ─── Empleado busca trabajo ───────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  @Get('jobs/:jobTypeId')
  findJobsForMe(
    @Param('jobTypeId', ParseIntPipe) jobTypeId: number,
    @Req() req,
  ) {
    return this.matchingService.findPostsForUser(req.user.id, jobTypeId);
  }

  // ─── Skills del usuario ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  @Get('skills')
  async getMySkills(@Req() req) {
    const profiles = await this.userProfileRepo.find({ where: { user_id: req.user.id } });
    return profiles.flatMap(p => p.skill_category_ids ?? []);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  @Put('skills')
  async setMySkills(@Body() body: { skill_category_ids: number[] }, @Req() req) {
    // Distribuir las skills por job_type via las categorías
    const profiles = await this.userProfileRepo.find({ where: { user_id: req.user.id } });
    for (const profile of profiles) {
      profile.skill_category_ids = body.skill_category_ids;
      await this.userProfileRepo.save(profile);
    }
    return { skill_category_ids: body.skill_category_ids };
  }

  // ─── Empresa publica búsqueda ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('company', 'admin')
  @Post('posts')
  async createJobPost(@Body() dto: CreateJobPostDto, @Req() req) {
    const post = this.jobPostRepo.create({
      ...dto,
      company_id: req.user.id, // en una cuenta company, el id es de la empresa
      is_active:  true,
    });
    return this.jobPostRepo.save(post);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('company', 'admin')
  @Get('posts/:id/candidates')
  findCandidates(@Param('id', ParseIntPipe) id: number) {
    return this.matchingService.findCandidatesForPost(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('company', 'admin')
  @Get('posts/my')
  getMyPosts(@Req() req) {
    return this.jobPostRepo.find({
      where: { company_id: req.user.id },
      order: { created_at: 'DESC' },
    });
  }
}