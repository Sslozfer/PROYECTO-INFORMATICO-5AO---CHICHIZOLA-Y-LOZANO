import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/users.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { FraudFlag } from '../fraud/fraud-flag.entity';
import { Rating } from '../ratings/ratings.entity';
import { VoterReliability } from '../scoring/voter-reliability.entity';
import { BadRequestException } from '@nestjs/common';

// Mock global de fetch
global.fetch = jest.fn();

const mockApiResponse = (content: string) => ({
  ok: true,
  json: () => Promise.resolve({
    content: [{ type: 'text', text: content }],
  }),
});

const mockQb = {
  innerJoin: jest.fn().mockReturnThis(),
  select:    jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where:     jest.fn().mockReturnThis(),
  andWhere:  jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([
    { category: 'Claridad', score: '80', votes: '10' },
  ]),
};

const mockUserRepo         = { findOne: jest.fn(), findByIds: jest.fn() };
const mockCategoryScoreRepo = { createQueryBuilder: jest.fn().mockReturnValue(mockQb) };
const mockCategoryRepo     = {};
const mockFraudFlagRepo    = { createQueryBuilder: jest.fn().mockReturnValue(mockQb) };
const mockRatingRepo       = { find: jest.fn() };
const mockReliabilityRepo  = { findOne: jest.fn() };

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('mock_key') } },
        { provide: getRepositoryToken(User),              useValue: mockUserRepo },
        { provide: getRepositoryToken(UserCategoryScore), useValue: mockCategoryScoreRepo },
        { provide: getRepositoryToken(EvaluationCategory), useValue: mockCategoryRepo },
        { provide: getRepositoryToken(FraudFlag),         useValue: mockFraudFlagRepo },
        { provide: getRepositoryToken(Rating),            useValue: mockRatingRepo },
        { provide: getRepositoryToken(VoterReliability),  useValue: mockReliabilityRepo },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
    mockCategoryScoreRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockFraudFlagRepo.createQueryBuilder.mockReturnValue({
      ...mockQb,
      getRawMany: jest.fn().mockResolvedValue([]),
    });
  });

  // ─── analyzeCv ───────────────────────────────────────────────────────────

  describe('analyzeCv', () => {
    it('lanza BadRequestException si el usuario no existe', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.analyzeCv(99, 'CV text')).rejects.toThrow(BadRequestException);
    });

    it('parsea correctamente la respuesta de la API', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1, name: 'Juan' });

      const apiResult = {
        extracted: {
          name: 'Juan Test', roles: ['Developer'],
          companies: ['Acme'], years_exp: 5, skills: ['React'],
        },
        coherence: {
          score: 85, flags: [], summary: 'Perfil coherente',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue(
        mockApiResponse(JSON.stringify(apiResult)),
      );

      const result = await service.analyzeCv(1, 'Mi CV...');

      expect(result).toHaveProperty('extracted');
      expect(result).toHaveProperty('coherence');
      expect(result.extracted.name).toBe('Juan Test');
      expect(result.coherence.score).toBe(85);
    });

    it('limpia bloques de código markdown en la respuesta', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1, name: 'Juan' });

      const apiResult = { extracted: { name: null, roles: [], companies: [], years_exp: null, skills: [] }, coherence: { score: 50, flags: [], summary: 'OK' } };

      (global.fetch as jest.Mock).mockResolvedValue(
        mockApiResponse('```json\n' + JSON.stringify(apiResult) + '\n```'),
      );

      const result = await service.analyzeCv(1, 'CV...');
      expect(result.coherence.score).toBe(50);
    });
  });

  // ─── analyzeFraudRisk ─────────────────────────────────────────────────────

  describe('analyzeFraudRisk', () => {
    it('lanza BadRequestException si el usuario no existe', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.analyzeFraudRisk(99)).rejects.toThrow(BadRequestException);
    });

    it('devuelve análisis de riesgo con nivel y razonamiento', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 1, name: 'Juan', fraud_score: 3, is_blocked: false,
      });
      mockReliabilityRepo.findOne.mockResolvedValue({
        reliability: 0.8, total_votes_cast: 20,
      });
      mockRatingRepo.find.mockResolvedValue([
        { score: 75 }, { score: 80 }, { score: 70 },
      ]);

      const apiResult = {
        risk_level:  'low',
        confidence:  85,
        reasoning:   'No hay patrones sospechosos claros.',
        suggestions: ['Monitorear en próximas semanas'],
      };

      (global.fetch as jest.Mock).mockResolvedValue(
        mockApiResponse(JSON.stringify(apiResult)),
      );

      const result = await service.analyzeFraudRisk(1);

      expect(result.risk_level).toBe('low');
      expect(result.confidence).toBe(85);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  // ─── generateHiringSuggestions ────────────────────────────────────────────

  describe('generateHiringSuggestions', () => {
    it('devuelve array vacío si no hay candidatos', async () => {
      const result = await service.generateHiringSuggestions(1, 'Dev', null, []);
      expect(result).toEqual([]);
    });

    it('genera sugerencias para los candidatos', async () => {
      mockUserRepo.findByIds.mockResolvedValue([
        { id: 1, name: 'Ana García' },
        { id: 2, name: 'Luis López' },
      ]);

      const apiResult = [
        {
          user_id: 1, name: 'Ana García', score: 90,
          justification: 'Excelente perfil técnico.',
          strengths: ['React', 'TypeScript'], concerns: [],
        },
        {
          user_id: 2, name: 'Luis López', score: 75,
          justification: 'Buen candidato con experiencia relevante.',
          strengths: ['Node.js'], concerns: ['Poca experiencia en liderazgo'],
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue(
        mockApiResponse(JSON.stringify(apiResult)),
      );

      const candidates = [
        { user_id: 1, compatibility_score: 90, details: { Claridad: 85 } },
        { user_id: 2, compatibility_score: 75, details: { Claridad: 70 } },
      ];

      const result = await service.generateHiringSuggestions(1, 'Developer Senior', 'Backend', candidates);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('justification');
      expect(result[0]).toHaveProperty('strengths');
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  describe('manejo de errores de API', () => {
    it('lanza BadRequestException si la API falla', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1, name: 'Juan' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false, statusText: 'Internal Server Error',
      });

      await expect(service.analyzeCv(1, 'CV...')).rejects.toThrow(BadRequestException);
    });
  });
});