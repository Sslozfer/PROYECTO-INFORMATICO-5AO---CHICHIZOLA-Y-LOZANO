import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/users.entity';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUser = {
  id:            1,
  name:          'Juan Test',
  email:         'juan@test.com',
  password_hash: '',
  role:          'user',
  is_blocked:    false,
  fraud_score:   0,
  performance_score: 0,
  global_trust_score: 1.0,
};

const mockUserRepo = {
  findOne: jest.fn(),
  create:  jest.fn(),
  save:    jest.fn(),
};

const mockJwtService = {
  sign:   jest.fn().mockReturnValue('mock_token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('mock_secret'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService,              useValue: mockJwtService },
        { provide: ConfigService,           useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─── Register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('crea un usuario nuevo y devuelve tokens', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue(mockUser);
      mockUserRepo.save.mockResolvedValue(mockUser);

      const result = await service.register({
        name:     'Juan Test',
        email:    'juan@test.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('lanza ConflictException si el email ya existe', async () => {
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({ name: 'Juan', email: 'juan@test.com', password: 'pass' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── Login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('devuelve tokens con credenciales correctas', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, password_hash: hash });

      const result = await service.login({
        email:    'juan@test.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('lanza UnauthorizedException si el usuario no existe', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'noexiste@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la password es incorrecta', async () => {
      const hash = await bcrypt.hash('correcta', 10);
      mockUserRepo.findOne.mockResolvedValue({ ...mockUser, password_hash: hash });

      await expect(
        service.login({ email: 'juan@test.com', password: 'incorrecta' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si el usuario está bloqueado', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockUserRepo.findOne.mockResolvedValue({
        ...mockUser,
        password_hash: hash,
        is_blocked:    true,
      });

      await expect(
        service.login({ email: 'juan@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('devuelve nuevos tokens con refresh token válido', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1, email: 'juan@test.com', role: 'user' });
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.refresh('valid_refresh_token');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('lanza UnauthorizedException si el refresh token es inválido', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.refresh('invalid_token')).rejects.toThrow(UnauthorizedException);
    });
  });
});