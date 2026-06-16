import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { User } from '../users/users.entity';
import { Company } from '../companies/company.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    TypeOrmModule.forFeature([User, Company]),
  ],
  controllers: [AuthController],
  providers:   [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports:     [AuthService, JwtModule],
})
export class AuthModule {}