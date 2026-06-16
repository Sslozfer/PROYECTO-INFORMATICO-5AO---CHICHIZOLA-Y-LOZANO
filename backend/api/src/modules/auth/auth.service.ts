import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/users.entity';
import { RegisterDto, LoginDto } from './auth.dto';

const BCRYPT_ROUNDS = 10;

export interface JwtPayload {
  sub:   number;
  email: string;
  role:  string;
}

@Injectable()
export class AuthService {
  private readonly refreshSecret:  string;
  private readonly refreshExpires = '7d';

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,

    private jwtService: JwtService,
    private config: ConfigService,
  ) {
    this.refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET')!;
  }

  // ─── Registro ────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ access_token: string; refresh_token: string }> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.userRepo.save(
      this.userRepo.create({
        name:          dto.name,
        email:         dto.email,
        password_hash,
        role:          dto.role ?? 'user',
      }),
    ) as User;

    return this.generateTokens(user);
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user)           throw new UnauthorizedException('Credenciales inválidas');
    if (user.is_blocked) throw new UnauthorizedException('Cuenta bloqueada');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    return this.generateTokens(user);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.is_blocked)
      throw new UnauthorizedException('Usuario no encontrado o bloqueado');

    return this.generateTokens(user);
  }

  // ─── Validar usuario desde JWT ───────────────────────────────────────────────

  async validateById(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user || user.is_blocked)
      throw new UnauthorizedException('Usuario no encontrado o bloqueado');
    return user;
  }

  // ─── Helper privado ──────────────────────────────────────────────────────────

  private generateTokens(user: User): { access_token: string; refresh_token: string } {
    const payload: JwtPayload = {
      sub:   user.id,
      email: user.email,
      role:  user.role,
    };

    const access_token = this.jwtService.sign(payload);

    const refresh_token = this.jwtService.sign(payload, {
      secret:    this.refreshSecret,
      expiresIn: this.refreshExpires,
    });

    return { access_token, refresh_token };
  }
}