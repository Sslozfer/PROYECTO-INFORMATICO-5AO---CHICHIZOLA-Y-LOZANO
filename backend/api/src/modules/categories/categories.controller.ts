import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateJobTypeDto, ApproveCategoryDto } from './categories.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── Públicos ────────────────────────────────────────────────────────────────

  @Get()
  getAll() {
    return this.categoriesService.getAllActiveCategories();
  }

  @Get('job-types')
  getJobTypes(@Query('active') active?: string) {
    return this.categoriesService.getJobTypes(active === 'true');
  }

  @Get('active')
  getActive(@Query('jobTypeId', ParseIntPipe) jobTypeId: number) {
    return this.categoriesService.getActiveCategories(jobTypeId);
  }

  // ─── Solo admin ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('job-types')
  createJobType(@Body() dto: CreateJobTypeDto) {
    return this.categoriesService.createJobType(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('job-types/:id/activate')
  activateJobType(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.activateJobType(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('job-types/:id/suggest')
  suggestCategories(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.suggestCategories(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('pending')
  getPending(@Query('jobTypeId') jobTypeId?: string) {
    return this.categoriesService.getPendingCategories(
      jobTypeId ? Number(jobTypeId) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  createManual(@Body() body: {
    job_type_id:     number;
    name:            string;
    description?:    string;
    employer_weight: number;
    peer_weight:     number;
    client_weight:   number;
    category_weight: number;
  }) {
    return this.categoriesService.createCategoryManually(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveCategoryDto) {
    return this.categoriesService.approveCategory(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.rejectCategory(id);
  }
}