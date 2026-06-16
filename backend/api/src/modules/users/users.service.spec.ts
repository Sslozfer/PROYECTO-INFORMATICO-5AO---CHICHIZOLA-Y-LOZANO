import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './users.entity';
import { UserCategoryScore } from '../scoring/user-category-score.entity';
import { EvaluationCategory } from '../categories/evaluation-category.entity';
import { Employment } from '../employments/employment.entity';
import { Company } from '../companies/company.entity';
import { UserProfile } from '../matching/user-profile.entity';
import { VoterReliability } from '../scoring/voter-reliability.entity';

const repo = () => ({ findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn(), createQueryBuilder: jest.fn() });

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User),              useValue: repo() },
        { provide: getRepositoryToken(UserCategoryScore), useValue: repo() },
        { provide: getRepositoryToken(EvaluationCategory), useValue: repo() },
        { provide: getRepositoryToken(Employment),        useValue: repo() },
        { provide: getRepositoryToken(Company),           useValue: repo() },
        { provide: getRepositoryToken(UserProfile),       useValue: repo() },
        { provide: getRepositoryToken(VoterReliability),  useValue: repo() },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => expect(service).toBeDefined());
});