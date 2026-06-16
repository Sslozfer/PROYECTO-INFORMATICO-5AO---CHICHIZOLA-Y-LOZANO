// employments.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EmploymentsController } from './employments.controller';
import { EmploymentsService } from './employments.service';

describe('EmploymentsController', () => {
  let controller: EmploymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmploymentsController],
      providers:   [{ provide: EmploymentsService, useValue: { create: jest.fn(), getByUser: jest.fn(), verifyByEmail: jest.fn(), verifyByDocument: jest.fn(), requestCompanyConfirmation: jest.fn(), confirmByCompany: jest.fn() } }],
    }).compile();
    controller = module.get<EmploymentsController>(EmploymentsController);
  });

  it('should be defined', () => expect(controller).toBeDefined());
});