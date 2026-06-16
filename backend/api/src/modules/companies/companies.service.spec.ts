import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from './companies.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from './company.entity';

describe('CompaniesService', () => {
  let service: CompaniesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: getRepositoryToken(Company), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn() } },
      ],
    }).compile();
    service = module.get<CompaniesService>(CompaniesService);
  });

  it('should be defined', () => expect(service).toBeDefined());
});