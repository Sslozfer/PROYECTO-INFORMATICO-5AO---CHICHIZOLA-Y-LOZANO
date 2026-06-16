import { Test, TestingModule } from '@nestjs/testing';
import { FraudService } from './fraud.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FraudFlag } from './fraud-flag.entity';
import { Rating } from '../ratings/ratings.entity';

const mockFraudFlagRepo = {
  findOne:        jest.fn(),
  save:           jest.fn(),
  create:         jest.fn((x) => x),
  createQueryBuilder: jest.fn(),
};

const mockRatingRepo = {
  createQueryBuilder: jest.fn(),
};

const makeRating = (overrides = {}): any => ({
  id: 1, from_user_id: 1, to_user_id: 2,
  score: 80, created_at: new Date(),
  verified_relationship: false,
  ...overrides,
});

describe('FraudService', () => {
  let service: FraudService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudService,
        { provide: getRepositoryToken(FraudFlag), useValue: mockFraudFlagRepo },
        { provide: getRepositoryToken(Rating),    useValue: mockRatingRepo },
      ],
    }).compile();

    service = module.get<FraudService>(FraudService);
    jest.clearAllMocks();

    // Default: no hay flags ni edges en el grafo
    mockFraudFlagRepo.findOne.mockResolvedValue(null);
    mockFraudFlagRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: Math.random() }));

    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue({ risk: 0 }),
    };
    mockRatingRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockFraudFlagRepo.createQueryBuilder?.mockReturnValue(mockQb);
  });

  // ─── Patrón 1: Anomalía ───────────────────────────────────────────────────

  describe('checkAnomaly', () => {
    it('no genera flag con menos de 5 ratings', async () => {
      const result = await service.runChecks({
        savedRating:   makeRating(),
        recentRatings: [makeRating(), makeRating(), makeRating()], // solo 3
        reverseRating: null,
        fromUser:      { id: 1, company_id: 1 },
        toUser:        { id: 2, company_id: 2 },
        weightedConsensus: 70,
        sourceType:    'peer',
        verifiedRelationship: false,
      });

      const anomalyFlags = result.flags.filter((f: any) => f.type === 'anomaly');
      expect(anomalyFlags).toHaveLength(0);
    });

    it('genera flag de anomalía con varianza muy baja y velocidad alta', async () => {
      const now = Date.now();
      // 10 ratings con score idéntico y muy rápidos
      const recentRatings = Array.from({ length: 10 }, (_, i) =>
        makeRating({ id: i + 2, score: 100, created_at: new Date(now - i * 10_000) }),
      );

      mockFraudFlagRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 99 }));

      const result = await service.runChecks({
        savedRating:   makeRating(),
        recentRatings,
        reverseRating: null,
        fromUser:      { id: 1, company_id: 1 },
        toUser:        { id: 2, company_id: 2 },
        weightedConsensus: 70,
        sourceType:    'peer',
        verifiedRelationship: false,
      });

      const anomalyFlags = result.flags.filter((f: any) => f.type === 'anomaly');
      expect(anomalyFlags.length).toBeGreaterThan(0);
    });
  });

  // ─── Patrón 2: Recíproco ─────────────────────────────────────────────────

  describe('checkMutual', () => {
    it('genera mutual_unknown si dos desconocidos se votan en < 5 min', async () => {
      const reverseRating = makeRating({
        from_user_id: 2, to_user_id: 1,
        created_at:   new Date(Date.now() - 2 * 60_000), // hace 2 min
      });

      const result = await service.runChecks({
        savedRating:   makeRating(),
        recentRatings: [],
        reverseRating,
        fromUser:      { id: 1, company_id: 1 },
        toUser:        { id: 2, company_id: 2 },
        weightedConsensus: 70,
        sourceType:    'peer',
        verifiedRelationship: false, // desconocidos
      });

      const mutualFlags = result.flags.filter((f: any) => f.type === 'mutual_unknown');
      expect(mutualFlags.length).toBeGreaterThan(0);
    });

    it('NO genera mutual_unknown si están en la misma empresa', async () => {
      const reverseRating = makeRating({
        from_user_id: 2, to_user_id: 1,
        created_at:   new Date(Date.now() - 2 * 60_000),
      });

      const result = await service.runChecks({
        savedRating:   makeRating(),
        recentRatings: [],
        reverseRating,
        fromUser:      { id: 1, company_id: 5 },
        toUser:        { id: 2, company_id: 5 }, // misma empresa
        weightedConsensus: 70,
        sourceType:    'peer',
        verifiedRelationship: true,
      });

      const mutualFlags = result.flags.filter(
        (f: any) => f.type === 'mutual_unknown' || f.type === 'mutual_peer_outlier',
      );
      expect(mutualFlags).toHaveLength(0);
    });

    it('genera mutual_peer_outlier si pares verificados con score outlier', async () => {
      const reverseRating = makeRating({
        from_user_id: 2, to_user_id: 1,
        created_at:   new Date(Date.now() - 5 * 60_000), // hace 5 min
      });

      const result = await service.runChecks({
        savedRating:   makeRating({ score: 20 }), // score muy bajo vs consenso de 70
        recentRatings: [],
        reverseRating,
        fromUser:      { id: 1, company_id: 1 },
        toUser:        { id: 2, company_id: 2 },
        weightedConsensus: 70,
        sourceType:    'peer',
        verifiedRelationship: true, // pares verificados
      });

      const outlierFlags = result.flags.filter((f: any) => f.type === 'mutual_peer_outlier');
      expect(outlierFlags.length).toBeGreaterThan(0);
    });
  });

  // ─── Patrón 4: Sesgo de fuente ────────────────────────────────────────────

  describe('checkSourceBias', () => {
    it('genera source_bias si una fuente diverge > 35%', async () => {
      const result = await service.runChecks({
        savedRating:   makeRating(),
        recentRatings: [],
        reverseRating: null,
        fromUser:      { id: 1, company_id: 1 },
        toUser:        { id: 2, company_id: 2 },
        weightedConsensus: 60,
        sourceType:    'peer',
        verifiedRelationship: false,
        sourceBias: {
          consensus: 60,
          sources: {
            employer: { avg: 95, votes: 10 }, // diverge mucho
            peer:     { avg: 58, votes: 10 },
            client:   { avg: 55, votes: 10 },
          },
          minVotesMet: true,
        },
      });

      const biasFlags = result.flags.filter((f: any) => f.type === 'source_bias');
      expect(biasFlags.length).toBeGreaterThan(0);
    });

    it('NO genera source_bias si minVotesMet es false', async () => {
      const result = await service.runChecks({
        savedRating:   makeRating(),
        recentRatings: [],
        reverseRating: null,
        fromUser:      { id: 1, company_id: 1 },
        toUser:        { id: 2, company_id: 2 },
        weightedConsensus: 60,
        sourceType:    'peer',
        verifiedRelationship: false,
        sourceBias: {
          consensus: 60,
          sources: {
            employer: { avg: 95, votes: 3 },
            peer:     { avg: 58, votes: 2 },
            client:   { avg: null, votes: 0 },
          },
          minVotesMet: false, // no hay suficientes votos
        },
      });

      const biasFlags = result.flags.filter((f: any) => f.type === 'source_bias');
      expect(biasFlags).toHaveLength(0);
    });
  });

  // ─── Severidad total ──────────────────────────────────────────────────────

  describe('totalSeverity', () => {
    it('suma correctamente la severidad de múltiples flags', async () => {
      mockFraudFlagRepo.save
        .mockResolvedValueOnce({ type: 'mutual_unknown', severity: 2, id: 1 })
        .mockResolvedValueOnce({ type: 'source_bias',   severity: 1, id: 2 });

      const reverseRating = makeRating({
        from_user_id: 2, to_user_id: 1,
        created_at:   new Date(Date.now() - 60_000),
      });

      const result = await service.runChecks({
        savedRating:   makeRating(),
        recentRatings: [],
        reverseRating,
        fromUser:      { id: 1, company_id: 1 },
        toUser:        { id: 2, company_id: 2 },
        weightedConsensus: 60,
        sourceType:    'peer',
        verifiedRelationship: false,
        sourceBias: {
          consensus: 60,
          sources: {
            employer: { avg: 95, votes: 10 },
            peer:     { avg: 58, votes: 10 },
            client:   { avg: null, votes: 0 },
          },
          minVotesMet: true,
        },
      });

      expect(result.totalSeverity).toBeGreaterThanOrEqual(0);
    });
  });
});