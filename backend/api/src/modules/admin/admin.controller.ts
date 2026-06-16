import { Controller, Get, Patch, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('fraud/summary')
  getFraudSummary() {
    return this.adminService.getFraudSummary();
  }

  @Get('fraud/detailed')
  getFraudDetailed() {
    return this.adminService.getFraudDetailed();
  }

  @Get('fraud/by-type')
  getFraudByType() {
    return this.adminService.getFraudByType();
  }

  @Get('fraud/pairs')
  getSuspiciousPairs() {
    return this.adminService.getSuspiciousPairs();
  }

  @Get('fraud/clusters')
  getFraudClusters() {
    return this.adminService.getFraudClusters();
  }

  @Get('fraud/high-risk')
  getHighRiskUsers(@Query('minRisk') minRisk?: string) {
    return this.adminService.getHighRiskUsers(minRisk ? Number(minRisk) : 5);
  }

  @Get('reliability/low')
  getLowReliabilityVoters(@Query('max') max?: string) {
    return this.adminService.getLowReliabilityVoters(max ? Number(max) : 0.6);
  }

  @Get('bias/report')
  getSourceBiasReport(@Query('minDivergence') min?: string) {
    return this.adminService.getSourceBiasReport(min ? Number(min) : 0.35);
  }

  @Get('users/blocked')
  getBlockedUsers() {
    return this.adminService.getBlockedUsers();
  }

  @Patch('users/:id/unblock')
  unblockUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.unblockUser(id);
  }
}