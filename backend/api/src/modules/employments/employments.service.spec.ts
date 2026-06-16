import { Test, TestingModule } from '@nestjs/testing';
import { EmploymentsService } from './employments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employment } from './employment.entity';
import { Company } from '../companies/company.entity';

describe('EmploymentsService', () => {
  let service: EmploymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmploymentsService,
        { provide: getRepositoryToken(Employment), useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(Company),    useValue: { findOne: jest.fn() } },
      ],
    }).compile();
    service = module.get<EmploymentsService>(EmploymentsService);
  });

  it('should be defined', () => expect(service).toBeDefined());
});