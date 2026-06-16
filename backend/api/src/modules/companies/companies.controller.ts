import {
  Controller, Get, Post, Patch, Put, Delete,
  Param, Body, Query, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';
import { IsArray, IsInt } from 'class-validator';

class SetJobTypesDto {
  @IsArray()
  @IsInt({ each: true })
  job_type_ids: number[];
}

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // ─── Públicos ─────────────────────────────────────────────────────────────────

  @Get()
  findAll(@Query('jobTypeId') jobTypeId?: string) {
    return this.companiesService.findAll(jobTypeId ? Number(jobTypeId) : undefined);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findOne(id);
  }

  @Get(':id/job-types')
  getJobTypes(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.getJobTypes(id);
  }

  // ─── Empresa: gestión propia ──────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('company', 'admin')
  @Get('me')
  getMyCompany(@Req() req) {
    return this.companiesService.getMyCompany(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('company', 'admin')
  @Put('me/job-types')
  setMyJobTypes(@Body() dto: SetJobTypesDto, @Req() req) {
    // Necesitamos el company_id de este user
    return this.companiesService.setMyJobTypes(req.user.id, dto.job_type_ids);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('company', 'admin')
  @Patch('me')
  updateMyCompany(@Body() dto: UpdateCompanyDto, @Req() req) {
    return this.companiesService.updateMyCompany(req.user.id, dto);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id/job-types')
  setJobTypes(@Param('id', ParseIntPipe) id: number, @Body() dto: SetJobTypesDto) {
    return this.companiesService.setJobTypes(id, dto.job_type_ids);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/verify-domain')
  verifyDomain(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.verifyDomain(id);
  }
}
