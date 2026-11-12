import { Module } from '@nestjs/common';
import { ConfigModule } from './config';
import { HealthModule } from './modules/health/health.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SourcesModule } from './modules/sources/sources.module';
import { TransitModule } from './modules/transit/transit.module';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { RedisModule } from './shared/infrastructure/redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    TransitModule,
    SourcesModule,
    RealtimeModule,
  ],
})
export class AppModule {}
