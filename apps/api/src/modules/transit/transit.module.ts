import { Module } from '@nestjs/common';
import { FindNearbyStopsUseCase } from './application/use-cases/find-nearby-stops.use-case';
import { GetLineDetailsUseCase } from './application/use-cases/get-line-details.use-case';
import { SearchLinesUseCase } from './application/use-cases/search-lines.use-case';
import { RouteRepository } from './domain/ports/route-repository.port';
import { StopRepository } from './domain/ports/stop-repository.port';
import { TypeormRouteRepository } from './infrastructure/persistence/typeorm-route.repository';
import { TypeormStopRepository } from './infrastructure/persistence/typeorm-stop.repository';
import { LinesController } from './presentation/http/lines.controller';
import { StopsController } from './presentation/http/stops.controller';

const USE_CASES = [SearchLinesUseCase, GetLineDetailsUseCase, FindNearbyStopsUseCase];

@Module({
  controllers: [LinesController, StopsController],
  providers: [
    ...USE_CASES,
    { provide: RouteRepository, useClass: TypeormRouteRepository },
    { provide: StopRepository, useClass: TypeormStopRepository },
  ],
  // Casos de uso exportados para o MCP (A4) e outros contextos.
  exports: USE_CASES,
})
export class TransitModule {}
