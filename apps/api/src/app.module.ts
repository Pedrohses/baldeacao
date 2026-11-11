import { Module } from '@nestjs/common';
import { ConfigModule } from './config';
import { HealthModule } from './modules/health/health.module';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { RedisModule } from './shared/infrastructure/redis/redis.module';

@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule, HealthModule],
})
export class AppModule {}
