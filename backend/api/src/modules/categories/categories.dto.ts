import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateJobTypeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ApproveCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  employer_weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  peer_weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  client_weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  category_weight?: number;
}