import { Injectable } from '@nestjs/common';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { StopRepository } from '../../domain/ports/stop-repository.port';
import type { SearchStopsByNameInput, SearchStopsByNameOutput } from '../dto/transit-queries.dto';

export const SEARCH_STOPS_MIN_LENGTH = 2;
export const SEARCH_STOPS_DEFAULT_LIMIT = 8;
export const SEARCH_STOPS_MAX_LIMIT = 20;

/** Busca de parada por nome, só no banco local (rápida o bastante para autocompletar). */
@Injectable()
export class SearchStopsByNameUseCase {
  constructor(private readonly stops: StopRepository) {}

  async execute(input: SearchStopsByNameInput): Promise<SearchStopsByNameOutput> {
    const text = input.text.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (text.length < SEARCH_STOPS_MIN_LENGTH) {
      throw new InvalidTransitQueryError(
        `Digite pelo menos ${SEARCH_STOPS_MIN_LENGTH} caracteres para buscar uma parada.`,
      );
    }
    const limit = Math.min(
      Math.max(1, Math.trunc(input.limit ?? SEARCH_STOPS_DEFAULT_LIMIT)),
      SEARCH_STOPS_MAX_LIMIT,
    );
    const matches = await this.stops.searchByName(text, limit);
    return {
      stops: matches.map((match) => match.stop),
      stationIds: matches.filter((match) => match.isStation).map((match) => match.stop.id),
    };
  }
}
