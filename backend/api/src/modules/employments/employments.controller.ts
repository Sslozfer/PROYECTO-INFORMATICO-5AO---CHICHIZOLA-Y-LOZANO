import {
  Controller, Post, Get, Body, Param,
  Req, BadRequestException, ParseIntPipe,
  UploadedFile, UseInterceptors, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmploymentsService } from './employments.service';
import { CreateEmploymentDto, VerifyByEmailDto, ConfirmByCompanyDto } from './employments.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('employments')
export class EmploymentsController {
  constructor(private readonly employmentsService: EmploymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateEmploymentDto, @Req() req) {
    return this.employmentsService.create(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyEmployments(@Req() req) {
    return this.employmentsService.getByUser(req.user.id);
  }

  @Get('user/:id')
  getByUser(@Param('id', ParseIntPipe) id: number) {
    return this.employmentsService.getByUser(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify/email')
  verifyByEmail(@Body() dto: VerifyByEmailDto, @Req() req) {
    return this.employmentsService.verifyByEmail(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/verify/document')
  @UseInterceptors(FileInterceptor('file'))
  verifyByDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Body('proof_type') proofType: 'doc' | 'contract',
    @Req() req,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    const fileUrl = `/uploads/${file.originalname}`;
    return this.employmentsService.verifyByDocument(req.user.id, id, fileUrl, proofType ?? 'doc');
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/verify/company/request')
  requestCompanyConfirmation(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.employmentsService.requestCompanyConfirmation(req.user.id, id);
  }

  // Este endpoint es público — la empresa confirma con el token sin estar logueada
  @Post('verify/company/confirm')
  confirmByCompany(@Body() dto: ConfirmByCompanyDto) {
    return this.employmentsService.confirmByCompany(dto.token);
  }
}