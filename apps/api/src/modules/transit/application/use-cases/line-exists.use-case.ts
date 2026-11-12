import { Injectable } from '@nestjs/common';
import { RouteRepository } from '../../domain/ports/route-repository.port';

export interface LineExistsInput {
  routeId: string;
}

export interface LineExistsOutput {
  exists: boolean;
  /** Sem a linha exata: códigos completos que começam com o texto (ex.: "875A" para "875A-10"). */
  suggestions: string[];
}

const MAX_SUGGESTIONS = 5;

/** Se a linha (route_id do GTFS) existe, sem carregar os traçados; senão, códigos parecidos. */
@Injectable()
export class LineExistsUseCase {
  constructor(private readonly routes: RouteRepository) {}

  async execute(input: LineExistsInput): Promise<LineExistsOutput> {
    const routeId = input.routeId.trim();
    if (!routeId) return { exists: false, suggestions: [] };
    if (await this.routes.findById(routeId)) return { exists: true, suggestions: [] };
    const prefix = `${routeId.toUpperCase()}-`;
    const similar = await this.routes.search(routeId, MAX_SUGGESTIONS * 4);
    const suggestions = similar
      .map((route) => route.id)
      .filter((id) => id.toUpperCase().startsWith(prefix))
      .slice(0, MAX_SUGGESTIONS);
    return { exists: false, suggestions };
  }
}
