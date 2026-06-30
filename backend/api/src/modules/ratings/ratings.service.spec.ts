import { Test, TestingModule } from '@nestjs/testing';
import { RatingsService } from './ratings.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Rating } from './ratings.entity';
import { User } from '../users/users.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { RatingWeight } from '../scoring/rating-weight.entity';
import { FraudService } from '../fraud/fraud.service';
import { ScoringService } from '../scoring/scoring.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockUser = (overrides = {}) => ({
  id: 1, name: 'Test', email: 'test@test.com',
  is_blocked: false, company_id: 1,
  global_trust_score: 50, performance_score: 60,
  fraud_score: 0, role: 'user',
  ...overrides,
});

const mockCategory = (overrides = {}) => ({
  id: 1, name: 'Claridad', job_type_id: 1,
  employer_weight: 5, peer_weight: 3, client_weight: 2,
  category_weight: 1, is_active: true,
  ...overrides,
});

const mockRating = (overrides = {}) => ({
  id: 1, from_user_id: 1, to_user_id: 2,
  evaluation_category_id: 1, score: 80,
  source_type: 'peer', created_at: new Date(),
  verified_relationship: false,
  ...overrides,
});

const mockRatingRepo = {
  findOne:  jest.fn(),
  find:     jest.fn(),
  count:    jest.fn(),
  create:   jest.fn(),
  save:     jest.fn(),
  manager:  { query: jest.fn().mockResolvedValue([]) },
};

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockCategoryRepo = {
  findOne: jest.fn(),
};

const mockRatingWeightRepo = {
  create: jest.fn(),
  save:   jest.fn(),
  update: jest.fn(),
};

const mockFraudService = {
  runChecks:    jest.fn().mockResolvedValue({ flags: [], totalSeverity: 0 }),
  getRiskScore: jest.fn().mockResolvedValue(0),
};

const mockScoringService = {
  buildWeightSnapshot:    jest.fn().mockResolvedValue({
    source_weight: 0.5, trust_weight: 0.5, reliability_weight: 1,
    context_weight: 0.8, time_weight: 1, anomaly_weight: 1, final_weight: 0.2,
  }),
  updateCategoryScore:    jest.fn().mockResolvedValue({ newScore: 75, weightedConsensus: 70 }),
  getSourceBiasData:      jest.fn().mockResolvedValue({ consensus: 70, sources: {}, minVotesMet: false }),
  updateFraudScore:       jest.fn().mockResolvedValue(undefined),
  updateVoterReliability: jest.fn().mockResolvedValue(1),
  updatePerformanceScore: jest.fn().mockResolvedValue(undefined),
};

describe('RatingsService', () => {
  let service: RatingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: getRepositoryToken(Rating),             useValue: mockRatingRepo },
        { provide: getRepositoryToken(User),               useValue: mockUserRepo },
        { provide: getRepositoryToken(EvaluationCategory), useValue: mockCategoryRepo },
        { provide: getRepositoryToken(RatingWeight),       useValue: mockRatingWeightRepo },
        { provide: FraudService,                           useValue: mockFraudService },
        { provide: ScoringService,                         useValue: mockScoringService },
      ],
    }).compile();

    service = module.get<RatingsService>(RatingsService);
    jest.clearAllMocks();
  });

  // ─── Validaciones básicas ─────────────────────────────────────────────────

  describe('create - validaciones', () => {
    it('lanza BadRequestException si from y to son el mismo usuario', async () => {
      await expect(
        service.create({
          from_user_id: 1, to_user_id: 1,
          evaluation_category_id: 1, score: 80, source_type: 'peer',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el usuario emisor está bloqueado', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(mockUser({ is_blocked: true }))
        .mockResolvedValueOnce(mockUser({ id: 2 }));
      mockCategoryRepo.findOne.mockResolvedValue(mockCategory());

      await expect(
        service.create({
          from_user_id: 1, to_user_id: 2,
          evaluation_category_id: 1, score: 80, source_type: 'peer',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si el usuario receptor no existe', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(mockUser())
        .mockResolvedValueOnce(null);
      mockCategoryRepo.findOne.mockResolvedValue(mockCategory());

      await expect(
        service.create({
          from_user_id: 1, to_user_id: 99,
          evaluation_category_id: 1, score: 80, source_type: 'peer',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException si la categoría no existe o está inactiva', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(mockUser())
        .mockResolvedValueOnce(mockUser({ id: 2 }));
      mockCategoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          from_user_id: 1, to_user_id: 2,
          evaluation_category_id: 99, score: 80, source_type: 'peer',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la fuente no tiene peso en la categoría', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(mockUser())
        .mockResolvedValueOnce(mockUser({ id: 2 }));
      mockCategoryRepo.findOne.mockResolvedValue(
        mockCategory({ employer_weight: 0, peer_weight: 0, client_weight: 5 }),
      );
      mockRatingRepo.count.mockResolvedValue(0);
      mockRatingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          from_user_id: 1, to_user_id: 2,
          evaluation_category_id: 1, score: 80, source_type: 'peer',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si se supera el rate limit', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(mockUser())
        .mockResolvedValueOnce(mockUser({ id: 2 }));
      mockCategoryRepo.findOne.mockResolvedValue(mockCategory());
      mockRatingRepo.count.mockResolvedValue(30); // límite alcanzado (RATE_LIMIT_PER_HOUR_USER = 30)

      await expect(
        service.create({
          from_user_id: 1, to_user_id: 2,
          evaluation_category_id: 1, score: 80, source_type: 'peer',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el cooldown está activo', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(mockUser())
        .mockResolvedValueOnce(mockUser({ id: 2 }));
      mockCategoryRepo.findOne.mockResolvedValue(mockCategory());
      mockRatingRepo.count.mockResolvedValue(0);
      // Último rating hace 2 minutos (menos que los 10 min de cooldown)
      mockRatingRepo.findOne.mockResolvedValue(
        mockRating({ created_at: new Date(Date.now() - 2 * 60_000) }),
      );

      await expect(
        service.create({
          from_user_id: 1, to_user_id: 2,
          evaluation_category_id: 1, score: 80, source_type: 'peer',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Flujo exitoso ────────────────────────────────────────────────────────

  describe('create - flujo exitoso', () => {
    beforeEach(() => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(mockUser())
        .mockResolvedValueOnce(mockUser({ id: 2 }));
      mockCategoryRepo.findOne.mockResolvedValue(mockCategory());
      mockRatingRepo.count.mockResolvedValue(0);
      mockRatingRepo.findOne.mockResolvedValue(null);
      mockRatingRepo.find.mockResolvedValue([]);
      mockRatingRepo.create.mockReturnValue(mockRating());
      mockRatingRepo.save.mockResolvedValue(mockRating());
      mockRatingWeightRepo.create.mockReturnValue({});
      mockRatingWeightRepo.save.mockResolvedValue({});
    });

    it('guarda el rating y llama a scoring y fraud', async () => {
      const result = await service.create({
        from_user_id: 1, to_user_id: 2,
        evaluation_category_id: 1, score: 80, source_type: 'peer',
      });

      expect(mockRatingRepo.save).toHaveBeenCalled();
      expect(mockScoringService.updateCategoryScore).toHaveBeenCalled();
      expect(mockFraudService.runChecks).toHaveBeenCalled();
      expect(mockScoringService.updatePerformanceScore).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('actualiza anomaly_weight si hay flags de fraude', async () => {
      mockFraudService.runChecks.mockResolvedValue({ flags: [{}], totalSeverity: 2 });

      await service.create({
        from_user_id: 1, to_user_id: 2,
        evaluation_category_id: 1, score: 80, source_type: 'peer',
      });

      expect(mockRatingWeightRepo.update).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({ anomaly_weight: expect.any(Number) }),
      );
    });
  });
});