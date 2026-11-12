import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { PlanTripUseCase } from './application/use-cases/plan-trip.use-case';
import { TripPlanner } from './domain/ports/trip-planner.port';
import { OtpClient } from './infrastructure/adapters/otp.client';
import { OtpTripPlannerAdapter } from './infrastructure/adapters/otp-trip-planner.adapter';
import { TripsController } from './presentation/http/trips.controller';

@Module({
  controllers: [TripsController],
  providers: [
    PlanTripUseCase,
    {
      provide: OtpClient,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => new OtpClient({ baseUrl: config.otpUrl }),
    },
    { provide: TripPlanner, useClass: OtpTripPlannerAdapter },
  ],
  // Caso de uso exportado para o MCP (A4).
  exports: [PlanTripUseCase],
})
export class RoutingModule {}
