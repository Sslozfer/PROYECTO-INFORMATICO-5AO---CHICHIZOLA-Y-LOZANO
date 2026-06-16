import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { EmploymentsModule } from './modules/employments/employments.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AuthModule } from './modules/auth/auth.module';
import { MatchingModule } from './modules/matching/matching.module';
import { AiModule } from './modules/ai/ai.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 100 },
      { name: 'auth',   ttl: 60_000, limit: 10  },
    ]),

    TypeOrmModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        type:             'postgres',
        host:             config.get('DB_HOST'),
        port:             config.get<number>('DB_PORT'),
        username:         config.get('DB_USERNAME'),
        password:         config.get('DB_PASSWORD'),
        database:         config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize:      false,
        ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),

    UsersModule,
    RatingsModule,
    EmploymentsModule,
    CompaniesModule,
    ScoringModule,
    FraudModule,
    CategoriesModule,
    AuthModule,
    MatchingModule,
    AiModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}