import {
  IsInt, IsOptional, IsString, IsNumber,
  IsIn, Min, IsBoolean,
} from 'class-validator';

export class UpsertUserProfileDto {
  @IsInt()
  job_type_id: number;

  @IsOptional() @IsNumber()
  latitude?: number;

  @IsOptional() @IsNumber()
  longitude?: number;

  @IsOptional() @IsString()
  location_label?: string;

  @IsOptional() @IsInt() @Min(0)
  salary_min?: number;

  @IsOptional() @IsInt() @Min(0)
  salary_max?: number;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(['remote', 'onsite', 'hybrid'])
  modality?: 'remote' | 'onsite' | 'hybrid';
}

export class CreateJobPostDto {
  @IsInt()
  job_type_id: number;

  @IsString()
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsNumber()
  latitude?: number;

  @IsOptional() @IsNumber()
  longitude?: number;

  @IsOptional() @IsString()
  location_label?: string;

  @IsOptional() @IsInt() @Min(0)
  salary_min?: number;

  @IsOptional() @IsInt() @Min(0)
  salary_max?: number;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional()
  @IsIn(['remote', 'onsite', 'hybrid'])
  modality?: 'remote' | 'onsite' | 'hybrid';

  @IsOptional()
  min_category_scores?: Record<string, number>;

  @IsOptional() @IsInt() @Min(1)
  radius_km?: number;

  // ─── Modo de contratación ─────────────────────────────────────────────────

  @IsOptional()
  @IsIn(['manual', 'semi_auto', 'auto'])
  hiring_mode?: 'manual' | 'semi_auto' | 'auto';

  @IsOptional() @IsNumber() @Min(0)
  auto_min_compatibility?: number;

  @IsOptional() @IsNumber() @Min(0)
  auto_min_category_score?: number;

  @IsOptional() @IsNumber() @Min(0)
  auto_max_distance_km?: number;

  @IsOptional() @IsBoolean()
  auto_require_identity?: boolean;

  @IsOptional() @IsInt() @Min(1)
  auto_offer_ttl_hours?: number;
}