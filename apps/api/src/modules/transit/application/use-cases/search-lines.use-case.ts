import { Injectable } from '@nestjs/common';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { RouteRepository } from '../../domain/ports/route-repository.port';
import type { SearchLinesInput, SearchLinesOutput } from '../dto/transit-queries.dto';

export const SEARCH_LINES_MIN_LENGTH = 2;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class SearchLinesUseCase {
  constructor(private readonly routes: RouteRepository) {}

  async execute(input: SearchLinesInput): Promise<SearchLinesOutput> {
    const text = input.text.trim();
    if (text.length < SEARCH_LINES_MIN_LENGTH) {
      throw new InvalidTransitQueryError(
        `Digite pelo menos ${SEARCH_LINES_MIN_LENGTH} caracteres para buscar uma linha.`,
      );
    }
    const limit = Math.min(Math.max(1, Math.trunc(input.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
    return { lines: await this.routes.search(text, limit) };
  }
}
