import { Module } from '@nestjs/common';
import { ConfigModule } from './config';
import { McpModule } from './mcp/mcp.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { HealthModule } from './modules/health/health.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RoutingModule } from './modules/routing/routing.module';
import { SourcesModule } from './modules/sources/sources.module';
import { TransitModule } from './modules/transit/transit.module';
import { DatabaseModule } from './shared/infrastructure/database/database.module';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { ThrottlingModule } from './shared/presentation/throttling/throttling.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    ThrottlingModule,
    HealthModule,
    TransitModule,
    SourcesModule,
    RealtimeModule,
    GeocodingModule,
    RoutingModule,
    McpModule,
  ],
})
export class AppModule {}
