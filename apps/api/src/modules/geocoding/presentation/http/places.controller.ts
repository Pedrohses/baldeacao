import {
  BadRequestException,
  Controller,
  Get,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  API_PATHS,
  type ApiErrorBody,
  SearchPlacesQuerySchema,
  type SearchPlacesResponse,
} from '@baldeacao/types';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { SearchPlacesUseCase } from '../../application/use-cases/search-places.use-case';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';

@Controller()
export class PlacesController {
  constructor(private readonly searchPlaces: SearchPlacesUseCase) {}

  /** Busca de lugar por texto: `mode=quick` (padrão) só paradas locais; `full` inclui o Nominatim. */
  @Get(API_PATHS.searchPlaces)
  async search(@Query() query: unknown): Promise<SearchPlacesResponse> {
    const parsed = SearchPlacesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_QUERY',
        message: 'Digite pelo menos 2 caracteres no parâmetro q para buscar um lugar.',
      } satisfies ApiErrorBody);
    }
    try {
      const { places } = await this.searchPlaces.execute({
        query: parsed.data.q,
        mode: parsed.data.mode,
      });
      return {
        places: places.map((place) => ({
          id: place.id,
          name: place.name,
          address: place.address,
          kind: place.kind,
          location: { lat: place.location.lat, lon: place.location.lon },
        })),
      };
    } catch (error) {
      if (error instanceof InvalidPlaceQueryError) {
        throw new BadRequestException({
          code: error.code,
          message: error.message,
        } satisfies ApiErrorBody);
      }
      if (error instanceof SourceUnavailableError) {
        throw new ServiceUnavailableException({
          code: error.code,
          message: error.message,
        } satisfies ApiErrorBody);
      }
      throw error;
    }
  }
}
