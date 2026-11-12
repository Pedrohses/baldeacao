import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfig } from '../../config';
import { OlhoVivoModule } from '../../shared/infrastructure/olho-vivo/olho-vivo.module';
import { BuildChannelUpdatesUseCase } from './application/use-cases/build-channel-updates.use-case';
import { GetVehicleSnapshotUseCase } from './application/use-cases/get-vehicle-snapshot.use-case';
import { RefreshVehiclePositionsUseCase } from './application/use-cases/refresh-vehicle-positions.use-case';
import { ClockPort } from './domain/ports/clock.port';
import { PositionsCycleNotifierPort } from './domain/ports/positions-cycle-notifier.port';
import { VehiclePositionsSourcePort } from './domain/ports/vehicle-positions-source.port';
import { VehiclePositionsStorePort } from './domain/ports/vehicle-positions-store.port';
import { OlhoVivoVehiclePositionsAdapter } from './infrastructure/adapters/olho-vivo-vehicle-positions.adapter';
import { RedisPositionsCycleNotifierAdapter } from './infrastructure/adapters/redis-positions-cycle-notifier.adapter';
import { RedisVehiclePositionsStoreAdapter } from './infrastructure/adapters/redis-vehicle-positions-store.adapter';
import { SystemClockAdapter } from './infrastructure/adapters/system-clock.adapter';
import { VehiclePositionsController } from './presentation/http/vehicle-positions.controller';
import { REALTIME_QUEUE } from './presentation/jobs/realtime-queue';
import { RefreshPositionsProcessor } from './presentation/jobs/refresh-positions.processor';
import { RefreshPositionsScheduler } from './presentation/jobs/refresh-positions.scheduler';
import { PositionsGateway } from './presentation/ws/positions.gateway';

@Module({
  imports: [
    OlhoVivoModule,
    // BullMQ abre conexões próprias (o worker exige maxRetriesPerRequest null).
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({ connection: { url: config.redisUrl } }),
    }),
    BullModule.registerQueue({ name: REALTIME_QUEUE }),
  ],
  controllers: [VehiclePositionsController],
  providers: [
    RefreshVehiclePositionsUseCase,
    GetVehicleSnapshotUseCase,
    BuildChannelUpdatesUseCase,
    { provide: VehiclePositionsSourcePort, useClass: OlhoVivoVehiclePositionsAdapter },
    { provide: VehiclePositionsStorePort, useClass: RedisVehiclePositionsStoreAdapter },
    { provide: PositionsCycleNotifierPort, useClass: RedisPositionsCycleNotifierAdapter },
    { provide: ClockPort, useClass: SystemClockAdapter },
    RefreshPositionsProcessor,
    RefreshPositionsScheduler,
    PositionsGateway,
  ],
})
export class RealtimeModule {}
