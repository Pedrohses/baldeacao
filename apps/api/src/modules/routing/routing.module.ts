import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { TransitModule } from '../transit/transit.module';
import { PlanTripUseCase } from './application/use-cases/plan-trip.use-case';
import { Clock } from './domain/ports/clock.port';
import { TripPlanner } from './domain/ports/trip-planner.port';
import { OtpClient } from './infrastructure/adapters/otp.client';
import { OtpTripPlannerAdapter } from './infrastructure/adapters/otp-trip-planner.adapter';
import { SystemClock } from './infrastructure/adapters/system-clock.adapter';
import { TripsController } from './presentation/http/trips.controller';

@Module({
  imports: [TransitModule, GeocodingModule],
  controllers: [TripsController],
  providers: [
    PlanTripUseCase,
    {
      provide: OtpClient,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => new OtpClient({ baseUrl: config.otpUrl }),
    },
    { provide: TripPlanner, useClass: OtpTripPlannerAdapter },
    { provide: Clock, useClass: SystemClock },
  ],
  // Caso de uso exportado para o MCP (A4).
  exports: [PlanTripUseCase],
})
export class RoutingModule {}
