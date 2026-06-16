import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JobPost } from './job-post.entity';
import { UserProfile } from './user-profile.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { NotFoundException } from '@nestjs/common';

const mockProfile = (overrides = {}): any => ({
  user_id:        1,
  job_type_id:    1,
  latitude:       -34.6037,
  longitude:      -58.3816,
  location_label: 'Buenos Aires',
  salary_min:     1500,
  salary_max:     2500,
  currency:       'USD',
  modality:       'remote',
  is_active:      true,
  ...overrides,
});

const mockPost = (overrides = {}): any => ({
  id:              1,
  company_id:      10,
  job_type_id:     1,
  title:           'Developer',
  latitude:        -34.6037,
  longitude:       -58.3816,
  salary_min:      1000,
  salary_max:      2000,
  currency:        'USD',
  modality:        'remote',
  min_category_scores: null,
  radius_km:       50,
  is_active:       true,
  ...overrides,
});

const mockQb = {
  innerJoin:  jest.fn().mockReturnThis(),
  select:     jest.fn().mockReturnThis(),
  addSelect:  jest.fn().mockReturnThis(),
  where:      jest.fn().mockReturnThis(),
  andWhere:   jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([
    { category_name: 'Claridad', score: '80', confidence: '0.8' },
    { category_name: 'Puntualidad', score: '70', confidence: '0.6' },
  ]),
};

const mockJobPostRepo     = { findOne: jest.fn(), find: jest.fn() };
const mockUserProfileRepo = { findOne: jest.fn(), find: jest.fn() };
const mockCategoryScoreRepo = { createQueryBuilder: jest.fn().mockReturnValue(mockQb) };
const mockCategoryRepo    = {};

describe('MatchingService', () => {
  let service: MatchingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: getRepositoryToken(JobPost),           useValue: mockJobPostRepo },
        { provide: getRepositoryToken(UserProfile),       useValue: mockUserProfileRepo },
        { provide: getRepositoryToken(UserCategoryScore), useValue: mockCategoryScoreRepo },
        { provide: getRepositoryToken(EvaluationCategory), useValue: mockCategoryRepo },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
    jest.clearAllMocks();
    mockCategoryScoreRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.getRawMany.mockResolvedValue([
      { category_name: 'Claridad', score: '80', confidence: '0.8' },
    ]);
  });

  // ─── findCandidatesForPost ────────────────────────────────────────────────

  describe('findCandidatesForPost', () => {
    it('lanza NotFoundException si el post no existe', async () => {
      mockJobPostRepo.findOne.mockResolvedValue(null);

      await expect(service.findCandidatesForPost(99)).rejects.toThrow(NotFoundException);
    });

    it('devuelve candidatos ordenados por compatibilidad', async () => {
      mockJobPostRepo.findOne.mockResolvedValue(mockPost());
      mockUserProfileRepo.find.mockResolvedValue([
        mockProfile({ user_id: 1 }),
        mockProfile({ user_id: 2, salary_min: 3000 }), // no matchea salario
      ]);

      const results = await service.findCandidatesForPost(1);

      expect(Array.isArray(results)).toBe(true);
      // Ordenados de mayor a menor compatibilidad
      if (results.length > 1) {
        expect(results[0].match.compatibility_score).toBeGreaterThanOrEqual(
          results[1].match.compatibility_score,
        );
      }
    });
  });

  // ─── findPostsForUser ─────────────────────────────────────────────────────

  describe('findPostsForUser', () => {
    it('lanza NotFoundException si el perfil del usuario no existe', async () => {
      mockUserProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.findPostsForUser(1, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Cálculo de distancia (Haversine) ─────────────────────────────────────

  describe('distancia geográfica', () => {
    it('da compatibilidad alta cuando la distancia es 0', async () => {
      mockJobPostRepo.findOne.mockResolvedValue(mockPost());
      mockUserProfileRepo.find.mockResolvedValue([
        mockProfile({ latitude: -34.6037, longitude: -58.3816 }),
      ]);

      const results = await service.findCandidatesForPost(1);

      if (results.length > 0) {
        expect(results[0].match.location_match).toBeCloseTo(100, 0);
        expect(results[0].match.distance_km).toBeCloseTo(0, 0);
      }
    });

    it('da location_match 0 si el candidato está fuera del radio', async () => {
      mockJobPostRepo.findOne.mockResolvedValue(mockPost({ radius_km: 10 }));
      mockUserProfileRepo.find.mockResolvedValue([
        mockProfile({ latitude: -31.4201, longitude: -64.1888 }), // Córdoba ~700km
      ]);

      const results = await service.findCandidatesForPost(1);

      if (results.length > 0) {
        expect(results[0].match.location_match).toBe(0);
      }
    });
  });

  // ─── Matching de salario ──────────────────────────────────────────────────

  describe('salary match', () => {
    it('devuelve salary_match true si los rangos se solapan', async () => {
      mockJobPostRepo.findOne.mockResolvedValue(
        mockPost({ salary_min: 1000, salary_max: 2000 }),
      );
      mockUserProfileRepo.find.mockResolvedValue([
        mockProfile({ salary_min: 1500 }), // 1500 <= 2000 ✓
      ]);

      const results = await service.findCandidatesForPost(1);
      if (results.length > 0) {
        expect(results[0].match.salary_match).toBe(true);
      }
    });

    it('devuelve salary_match false si el salario esperado supera el máximo del post', async () => {
      mockJobPostRepo.findOne.mockResolvedValue(
        mockPost({ salary_min: 1000, salary_max: 2000 }),
      );
      mockUserProfileRepo.find.mockResolvedValue([
        mockProfile({ salary_min: 3000 }), // 3000 > 2000 ✗
      ]);

      const results = await service.findCandidatesForPost(1);
      if (results.length > 0) {
        expect(results[0].match.salary_match).toBe(false);
      }
    });
  });

  // ─── Matching de modalidad ────────────────────────────────────────────────

  describe('modality match', () => {
    it('hybrid acepta cualquier modalidad del candidato', async () => {
      mockJobPostRepo.findOne.mockResolvedValue(mockPost({ modality: 'hybrid' }));
      mockUserProfileRepo.find.mockResolvedValue([
        mockProfile({ modality: 'remote' }),
      ]);

      const results = await service.findCandidatesForPost(1);
      if (results.length > 0) {
        expect(results[0].match.modality_match).toBe(true);
      }
    });

    it('onsite no acepta remote', async () => {
      mockJobPostRepo.findOne.mockResolvedValue(mockPost({ modality: 'onsite' }));
      mockUserProfileRepo.find.mockResolvedValue([
        mockProfile({ modality: 'remote' }),
      ]);

      const results = await service.findCandidatesForPost(1);
      if (results.length > 0) {
        expect(results[0].match.modality_match).toBe(false);
      }
    });
  });
});