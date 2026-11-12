import { Module } from '@nestjs/common';
import { OlhoVivoModule } from '../../shared/infrastructure/olho-vivo/olho-vivo.module';
import { FindNearbyStopsUseCase } from './application/use-cases/find-nearby-stops.use-case';
import { GetLineDetailsUseCase } from './application/use-cases/get-line-details.use-case';
import { GetStopArrivalsUseCase } from './application/use-cases/get-stop-arrivals.use-case';
import { SearchLinesUseCase } from './application/use-cases/search-lines.use-case';
import { ArrivalsCache } from './domain/ports/arrivals-cache.port';
import { ArrivalsProvider } from './domain/ports/arrivals-provider.port';
import { RouteRepository } from './domain/ports/route-repository.port';
import { StopRepository } from './domain/ports/stop-repository.port';
import { OlhoVivoArrivalsAdapter } from './infrastructure/adapters/olho-vivo-arrivals.adapter';
import { RedisArrivalsCache } from './infrastructure/adapters/redis-arrivals-cache.adapter';
import { TypeormRouteRepository } from './infrastructure/persistence/typeorm-route.repository';
import { TypeormStopRepository } from './infrastructure/persistence/typeorm-stop.repository';
import { LinesController } from './presentation/http/lines.controller';
import { StopsController } from './presentation/http/stops.controller';

const USE_CASES = [
  SearchLinesUseCase,
  GetLineDetailsUseCase,
  FindNearbyStopsUseCase,
  GetStopArrivalsUseCase,
];

@Module({
  imports: [OlhoVivoModule],
  controllers: [LinesController, StopsController],
  providers: [
    ...USE_CASES,
    { provide: RouteRepository, useClass: TypeormRouteRepository },
    { provide: StopRepository, useClass: TypeormStopRepository },
    { provide: ArrivalsProvider, useClass: OlhoVivoArrivalsAdapter },
    { provide: ArrivalsCache, useClass: RedisArrivalsCache },
  ],
  // Casos de uso exportados para o MCP (A4) e outros contextos.
  exports: USE_CASES,
})
export class TransitModule {}
