import { IsInt, IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateEmploymentDto {
  @IsInt()
  company_id: number;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}

export class VerifyByEmailDto {
  @IsInt()
  employment_id: number;

  @IsString()
  corporate_email: string; // debe matchear el dominio de la empresa
}

export class ConfirmByCompanyDto {
  @IsString()
  token: string;
}