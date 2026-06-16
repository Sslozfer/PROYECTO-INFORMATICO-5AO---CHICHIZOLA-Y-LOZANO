import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // 'user' por defecto, 'company' si es cuenta de empresa
  @IsOptional()
  @IsIn(['user', 'company'])
  role?: 'user' | 'company';

  // Solo para cuentas company
  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  domain?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  refresh_token: string;
}