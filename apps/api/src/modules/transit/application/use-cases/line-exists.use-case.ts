import { Injectable } from '@nestjs/common';
import { RouteRepository } from '../../domain/ports/route-repository.port';

export interface LineExistsInput {
  routeId: string;
}

export interface LineExistsOutput {
  exists: boolean;
}

/** Se a linha (route_id do GTFS) existe, sem carregar os traçados. */
@Injectable()
export class LineExistsUseCase {
  constructor(private readonly routes: RouteRepository) {}

  async execute(input: LineExistsInput): Promise<LineExistsOutput> {
    const routeId = input.routeId.trim();
    if (!routeId) return { exists: false };
    return { exists: (await this.routes.findById(routeId)) !== null };
  }
}
