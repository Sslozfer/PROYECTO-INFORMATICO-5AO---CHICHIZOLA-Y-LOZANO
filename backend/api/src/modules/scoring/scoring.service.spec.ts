import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/users.entity';
import { UserCategoryScore } from './user-category-score.entity';
import { VoterReliability } from './voter-reliability.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { ScoreChangeLog } from './score-change-log.entity';

const mockCategory = {
  id: 1, employer_weight: 6, peer_weight: 3, client_weight: 1,
  category_weight: 1, is_active: true,
};

const mockUserRepo         = { update: jest.fn(), findOne: jest.fn() };
const mockCategoryScoreRepo = {
  findOne:        jest.fn(),
  create:         jest.fn(),
  save:           jest.fn(),
  createQueryBuilder: jest.fn(),
};
const mockReliabilityRepo  = {
  findOne: jest.fn(),
  create:  jest.fn(),
  save:    jest.fn(),
};
const mockCategoryRepo     = { findOne: jest.fn() };
const mockChangeLogRepo    = { save: jest.fn() };

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: getRepositoryToken(User),              useValue: mockUserRepo },
        { provide: getRepositoryToken(UserCategoryScore), useValue: mockCategoryScoreRepo },
        { provide: getRepositoryToken(VoterReliability),  useValue: mockReliabilityRepo },
        { provide: getRepositoryToken(EvaluationCategory), useValue: mockCategoryRepo },
        { provide: getRepositoryToken(ScoreChangeLog),    useValue: mockChangeLogRepo },
      ],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
    jest.clearAllMocks();
  });

  // ─── buildWeightSnapshot ─────────────────────────────────────────────────

  describe('buildWeightSnapshot', () => {
    it('normaliza source_weight correctamente', async () => {
      mockReliabilityRepo.findOne.mockResolvedValue({ reliability: 1.0 });

      const fromUser = { id: 1, global_trust_score: 50 } as any;
      const snapshot = await service.buildWeightSnapshot({
        fromUser,
        category:    mockCategory as any,
        sourceType:  'employer',
        contextType: 'direct_manager',
        createdAt:   new Date(),
      });

      // employer_weight = 6, total = 10 → source_weight = 0.6
      expect(snapshot.source_weight).toBeCloseTo(0.6);
      expect(snapshot.final_weight).toBeGreaterThan(0);
    });

    it('normaliza trust_weight a rango 0.1-1.0', async () => {
      mockReliabilityRepo.findOne.mockResolvedValue({ reliability: 1.0 });

      const fromUser = { id: 1, global_trust_score: 100 } as any;
      const snapshot = await service.buildWeightSnapshot({
        fromUser,
        category:    mockCategory as any,
        sourceType:  'peer',
        contextType: 'occasional',
        createdAt:   new Date(),
      });

      expect(snapshot.trust_weight).toBeLessThanOrEqual(1.0);
      expect(snapshot.trust_weight).toBeGreaterThanOrEqual(0.1);
    });
  });

  // ─── updateCategoryScore ─────────────────────────────────────────────────

  describe('updateCategoryScore', () => {
    it('crea registro nuevo si no existe', async () => {
      mockCategoryScoreRepo.findOne.mockResolvedValue(null);
      mockCategoryScoreRepo.create.mockReturnValue({
        user_id: 2, evaluation_category_id: 1,
        score: 0, confidence: 0, vote_count: 0,
        employer_weighted_sum: 0, employer_weight_sum: 0,
        peer_weighted_sum: 0, peer_weight_sum: 0,
        client_weighted_sum: 0, client_weight_sum: 0,
      });
      mockCategoryScoreRepo.save.mockResolvedValue({ score: 80 });

      const result = await service.updateCategoryScore({
        toUserId: 2, categoryId: 1, score: 80,
        sourceType: 'peer', finalWeight: 0.5,
      });

      expect(mockCategoryScoreRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('weightedConsensus');
    });

    it('acumula correctamente por fuente', async () => {
      const existing = {
        user_id: 2, evaluation_category_id: 1,
        score: 60, confidence: 0.5, vote_count: 5,
        employer_weighted_sum: 0, employer_weight_sum: 0,
        peer_weighted_sum: 30, peer_weight_sum: 0.5,
        client_weighted_sum: 0, client_weight_sum: 0,
      };
      mockCategoryScoreRepo.findOne.mockResolvedValue(existing);
      mockCategoryScoreRepo.save.mockResolvedValue({ ...existing, score: 65 });

      await service.updateCategoryScore({
        toUserId: 2, categoryId: 1, score: 80,
        sourceType: 'peer', finalWeight: 0.5,
      });

      // peer_weighted_sum debe haber aumentado
      expect(existing.peer_weighted_sum).toBeGreaterThan(30);
    });
  });

  // ─── updateVoterReliability ───────────────────────────────────────────────

  describe('updateVoterReliability', () => {
    it('incrementa deviation_streak si el voto es outlier', async () => {
      const record = {
        user_id: 1, reliability: 1.0,
        deviation_streak: 0, recovery_streak: 0, total_votes_cast: 10,
      };
      mockReliabilityRepo.findOne.mockResolvedValue(record);
      mockReliabilityRepo.save.mockResolvedValue(record);

      // Voto de 100, consenso de 50 → desviación del 100% → outlier
      await service.updateVoterReliability({
        fromUserId: 1, voteScore: 100, weightedConsensus: 50,
      });

      expect(record.deviation_streak).toBe(1);
      expect(record.recovery_streak).toBe(0);
    });

    it('baja reliability después de 3 votos outlier consecutivos', async () => {
      const record = {
        user_id: 1, reliability: 1.0,
        deviation_streak: 2, recovery_streak: 0, total_votes_cast: 10,
      };
      mockReliabilityRepo.findOne.mockResolvedValue(record);
      mockReliabilityRepo.save.mockResolvedValue(record);
      mockChangeLogRepo.save.mockResolvedValue({});

      await service.updateVoterReliability({
        fromUserId: 1, voteScore: 100, weightedConsensus: 50,
      });

      expect(record.reliability).toBeLessThan(1.0);
      expect(record.deviation_streak).toBe(0); // se resetea
    });

    it('incrementa recovery_streak si el voto está dentro del consenso', async () => {
      const record = {
        user_id: 1, reliability: 0.7,
        deviation_streak: 0, recovery_streak: 0, total_votes_cast: 10,
      };
      mockReliabilityRepo.findOne.mockResolvedValue(record);
      mockReliabilityRepo.save.mockResolvedValue(record);

      // Voto de 72, consenso de 70 → desviación del ~3% → no es outlier
      await service.updateVoterReliability({
        fromUserId: 1, voteScore: 72, weightedConsensus: 70,
      });

      expect(record.recovery_streak).toBe(1);
      expect(record.deviation_streak).toBe(0);
    });

    it('sube reliability después de 5 votos consecutivos dentro del consenso', async () => {
      const record = {
        user_id: 1, reliability: 0.7,
        deviation_streak: 0, recovery_streak: 4, total_votes_cast: 20,
      };
      mockReliabilityRepo.findOne.mockResolvedValue(record);
      mockReliabilityRepo.save.mockResolvedValue(record);
      mockChangeLogRepo.save.mockResolvedValue({});

      await service.updateVoterReliability({
        fromUserId: 1, voteScore: 72, weightedConsensus: 70,
      });

      expect(record.reliability).toBeGreaterThan(0.7);
      expect(record.recovery_streak).toBe(0); // se resetea
    });
  });

  // ─── updateFraudScore ─────────────────────────────────────────────────────

  describe('updateFraudScore', () => {
    it('bloquea usuario si fraud_score >= 11', async () => {
      mockUserRepo.update.mockResolvedValue({});
      mockChangeLogRepo.save.mockResolvedValue({});

      await service.updateFraudScore(1, 12);

      expect(mockUserRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({
        is_blocked: true,
      }));
    });

    it('no bloquea si fraud_score < 11', async () => {
      mockUserRepo.update.mockResolvedValue({});

      await service.updateFraudScore(1, 5);

      expect(mockUserRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({
        is_blocked: false,
      }));
    });
  });
});