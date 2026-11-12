import { Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import {
  API_PATHS,
  type LineDetailsResponse,
  type SearchLinesQuery,
  SearchLinesQuerySchema,
  type SearchLinesResponse,
} from '@baldeacao/types';
import { z } from 'zod';
import { GetLineDetailsUseCase } from '../../application/use-cases/get-line-details.use-case';
import { SearchLinesUseCase } from '../../application/use-cases/search-lines.use-case';
import { DomainErrorFilter } from './domain-error.filter';
import { TransitResponseMapper } from './transit-response.mapper';
import { ZodValidationPipe } from './zod-validation.pipe';

const RouteIdSchema = z.string().trim().min(1);

@Controller()
@UseFilters(DomainErrorFilter)
export class LinesController {
  constructor(
    private readonly searchLines: SearchLinesUseCase,
    private readonly getLineDetails: GetLineDetailsUseCase,
  ) {}

  @Get(API_PATHS.searchLines)
  async search(
    @Query(new ZodValidationPipe(SearchLinesQuerySchema)) query: SearchLinesQuery,
  ): Promise<SearchLinesResponse> {
    const { lines } = await this.searchLines.execute({ text: query.q });
    return { lines: lines.map((line) => TransitResponseMapper.route(line)) };
  }

  // API_PATHS.lineDetails(routeId) === `/lines/${encodeURIComponent(routeId)}`
  @Get('/lines/:routeId')
  async details(
    @Param('routeId', new ZodValidationPipe(RouteIdSchema)) routeId: string,
  ): Promise<LineDetailsResponse> {
    const { line, shapes } = await this.getLineDetails.execute({ routeId });
    return {
      line: TransitResponseMapper.route(line),
      shapes: shapes.map((shape) => TransitResponseMapper.lineShape(shape)),
    };
  }
}
