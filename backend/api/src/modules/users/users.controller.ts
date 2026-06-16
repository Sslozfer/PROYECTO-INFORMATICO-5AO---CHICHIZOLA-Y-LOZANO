import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/jwt-auth.guard';
import { User } from './users.entity';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Crear usuario (sin auth — lo usa el registro, pero también útil para tests)
  @Post()
  create(@Body() data: Partial<User>) {
    return this.usersService.create(data);
  }

  @Get('lookup')
  lookup(@Query('q') q: string) {
    if (!q || q.trim().length < 1) return [];
    return this.usersService.lookupUser(q.trim());
  }

  // Ranking público (opcionalmente filtrado por rubro/job_type)
  @Get('ranking')
  getRanking(
    @Query('jobTypeId')  jobTypeId?:  string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.usersService.getRanking(
      jobTypeId  ? Number(jobTypeId)  : undefined,
      categoryId ? Number(categoryId) : undefined,
    );
  }

  // Perfil propio
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getOwnProfile(@Req() req) {
    return this.usersService.getOwnProfile(req.user.id);
  }

  // Editar perfil propio (nombre / email)
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateOwnProfile(@Body() data: { name?: string; email?: string }, @Req() req) {
    return this.usersService.updateOwnProfile(req.user.id, data);
  }

  // Perfil público — cualquiera
  @Get(':id')
  getPublicProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getPublicProfile(id);
  }

  // Perfil para empresas — agrega zona y salario si busca empleo
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('company', 'admin')
  @Get(':id/company-view')
  getCompanyProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getCompanyProfile(id);
  }

  // Perfil admin — agrega fraud score y reliability
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id/admin-view')
  getAdminProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getAdminProfile(id);
  }
}