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
  ReversePlaceQuerySchema,
  type ReversePlaceResponse,
  SearchPlacesQuerySchema,
  type SearchPlacesResponse,
} from '@baldeacao/types';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { friendlySourceMessage } from '../../../../shared/presentation/source-messages';
import { formatZodIssues } from '../../../../shared/presentation/zod-issues';
import { ReversePlaceUseCase } from '../../application/use-cases/reverse-place.use-case';
import { SearchPlacesUseCase } from '../../application/use-cases/search-places.use-case';
import type { Place } from '../../domain/entities/place.entity';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';

function toResponsePlace(place: Place) {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    kind: place.kind,
    location: { lat: place.location.lat, lon: place.location.lon },
  };
}

/** Mensagem própria para q curto e para mode inválido; o resto pelo mapeador pt-BR. */
function searchQueryMessage(issues: Parameters<typeof formatZodIssues>[0]): string {
  const fields = new Set(issues.map((issue) => String(issue.path[0] ?? '')));
  const parts: string[] = [];
  if (fields.has('q')) {
    parts.push('Digite pelo menos 2 caracteres no parâmetro q para buscar um lugar.');
  }
  if (fields.has('mode')) parts.push('Parâmetro mode inválido: use "quick" ou "full".');
  const others = issues.filter((issue) => !['q', 'mode'].includes(String(issue.path[0] ?? '')));
  if (others.length > 0) parts.push(`Parâmetros inválidos (${formatZodIssues(others)}).`);
  return parts.join(' ');
}

function toHttpError(error: unknown): unknown {
  if (error instanceof InvalidPlaceQueryError) {
    return new BadRequestException({
      code: error.code,
      message: error.message,
    } satisfies ApiErrorBody);
  }
  if (error instanceof SourceUnavailableError) {
    return new ServiceUnavailableException({
      code: error.code,
      message: friendlySourceMessage(error),
    } satisfies ApiErrorBody);
  }
  return error;
}

@Controller()
export class PlacesController {
  constructor(
    private readonly searchPlaces: SearchPlacesUseCase,
    private readonly reversePlace: ReversePlaceUseCase,
  ) {}

  /** Busca de lugar por texto: `mode=quick` (padrão) só paradas locais; `full` inclui o Nominatim. */
  @Get(API_PATHS.searchPlaces)
  async search(@Query() query: unknown): Promise<SearchPlacesResponse> {
    const parsed = SearchPlacesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_QUERY',
        message: searchQueryMessage(parsed.error.issues),
      } satisfies ApiErrorBody);
    }
    try {
      const { places } = await this.searchPlaces.execute({
        query: parsed.data.q,
        mode: parsed.data.mode,
      });
      return { places: places.map(toResponsePlace) };
    } catch (error) {
      throw toHttpError(error);
    }
  }

  /** Lugar mais próximo de um ponto: local a até 60 m, senão Nominatim (com cache). */
  @Get(API_PATHS.reversePlace)
  async reverse(@Query() query: unknown): Promise<ReversePlaceResponse> {
    const parsed = ReversePlaceQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_QUERY',
        message: 'Informe lat (-90 a 90) e lon (-180 a 180) para buscar o lugar do ponto.',
      } satisfies ApiErrorBody);
    }
    try {
      const { place } = await this.reversePlace.execute({
        location: { lat: parsed.data.lat, lon: parsed.data.lon },
      });
      return { place: place ? toResponsePlace(place) : null };
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
