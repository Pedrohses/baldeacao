import { Module } from '@nestjs/common';
import { CheckHealthUseCase } from './application/use-cases/check-health.use-case';
import { CacheHealthPort } from './domain/ports/cache-health.port';
import { DatabaseHealthPort } from './domain/ports/database-health.port';
import { PostgresHealthAdapter } from './infrastructure/adapters/postgres-health.adapter';
import { RedisHealthAdapter } from './infrastructure/adapters/redis-health.adapter';
import { HealthController } from './presentation/http/health.controller';

@Module({
  controllers: [HealthController],
  providers: [
    CheckHealthUseCase,
    { provide: DatabaseHealthPort, useClass: PostgresHealthAdapter },
    { provide: CacheHealthPort, useClass: RedisHealthAdapter },
  ],
})
export class HealthModule {}
