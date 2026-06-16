import {
  Controller, Post, Get, Param, Body,
  Req, UseGuards, ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { MatchingService } from '../matching/matching.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';
import { IsString, IsInt, IsOptional } from 'class-validator';

export class AnalyzeCvDto {
  @IsString()
  cv_text: string;
}

export class HiringSuggestionsDto {
  @IsInt()
  job_post_id: number;

  @IsString()
  job_title: string;

  @IsOptional()
  @IsString()
  job_description?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService:       AiService,
    private readonly matchingService: MatchingService,
  ) {}

  // ─── Análisis de CV (usuario analiza su propio CV) ───────────────────────────

  @Post('cv/analyze')
  analyzeCv(@Body() dto: AnalyzeCvDto, @Req() req) {
    return this.aiService.analyzeCv(req.user.id, dto.cv_text);
  }

  // ─── Análisis de fraude (solo admin) ─────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('fraud/:userId')
  analyzeFraud(@Param('userId', ParseIntPipe) userId: number) {
    return this.aiService.analyzeFraudRisk(userId);
  }

  // ─── Sugerencias de contratación (empresa o admin) ───────────────────────────

  @UseGuards(RolesGuard)
  @Roles('company', 'admin')
  @Post('hiring/suggest')
  async hiringSuggestions(@Body() dto: HiringSuggestionsDto) {
    // Primero corre el matching para obtener candidatos pre-filtrados
    const matches = await this.matchingService.findCandidatesForPost(dto.job_post_id);

    if (matches.length === 0)
      throw new BadRequestException('No se encontraron candidatos para este puesto');

    // Toma los top 10 para no sobrecargar el contexto de la IA
    const top = matches.slice(0, 10).map(m => ({
      user_id:             m.user_id,
      compatibility_score: m.match.compatibility_score,
      details:             m.match.details,
    }));

    return this.aiService.generateHiringSuggestions(
      dto.job_post_id,
      dto.job_title,
      dto.job_description ?? null,
      top,
    );
  }
}