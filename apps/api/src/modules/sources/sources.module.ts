import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GTFS_REFRESH_QUEUE } from './presentation/jobs/gtfs-refresh-queue';
import { RefreshGtfsProcessor } from './presentation/jobs/refresh-gtfs.processor';
import { RefreshGtfsScheduler } from './presentation/jobs/refresh-gtfs.scheduler';
import { SourcesCoreModule } from './sources-core.module';

// A conexão do BullMQ (forRoot) vem do RealtimeModule, que é global.
@Module({
  imports: [SourcesCoreModule, BullModule.registerQueue({ name: GTFS_REFRESH_QUEUE })],
  providers: [RefreshGtfsProcessor, RefreshGtfsScheduler],
  exports: [SourcesCoreModule],
})
export class SourcesModule {}
