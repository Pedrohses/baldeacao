import { Injectable, Logger } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { cityInput, resolveCity, unsupportedCityMessage } from '../../../../mcp/city';
import { formatClock, plural } from '../../../../mcp/format';
import { McpTool } from '../../../../mcp/mcp-tool';
import { runTool, toolError, toolText } from '../../../../mcp/tool-result';
import { SearchPlacesUseCase } from '../../../geocoding/application/use-cases/search-places.use-case';
import {
  PLAN_TRIP_DEFAULT_ITINERARIES,
  PLAN_TRIP_MAX_ITINERARIES,
  PlanTripUseCase,
} from '../../application/use-cases/plan-trip.use-case';
import type { Itinerary, Leg, TripMode } from '../../domain/entities/itinerary.entity';
import { toTripDateTime } from './trip-time';

const timeInput = z.string().trim().min(1).max(40).optional();

const inputSchema = {
  origem: z
    .string()
    .trim()
    .min(3, 'Informe a origem com pelo menos 3 caracteres.')
    .max(200)
    .describe(
      'De onde sai: endereço, lugar ou estação (ex.: "Morumbis", "Av. Paulista, 1578") ou "latitude,longitude".',
    ),
  destino: z
    .string()
    .trim()
    .min(3, 'Informe o destino com pelo menos 3 caracteres.')
    .max(200)
    .describe('Para onde vai, no mesmo formato da origem (ex.: "Terminal Tietê").'),
  saida: timeInput.describe(
    'Sair a partir de: "08:00" (hoje no horário local, ou amanhã se já passou) ou ISO 8601 com fuso. Sem saida nem chegada, sai agora.',
  ),
  chegada: timeInput.describe(
    'Chegar até, no mesmo formato de saida. Use saida ou chegada, não as duas.',
  ),
  opcoes: z
    .number()
    .int()
    .min(1)
    .max(PLAN_TRIP_MAX_ITINERARIES)
    .optional()
    .describe(`Quantas opções de itinerário (padrão ${PLAN_TRIP_DEFAULT_ITINERARIES}).`),
  cidade: cityInput,
};

const placeOutput = z.object({
  nome: z.string(),
  endereco: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
});

const outputSchema = {
  cidade: z.string(),
  origem: placeOutput,
  destino: placeOutput,
  itinerarios: z.array(
    z.object({
      saida: z.string(),
      chegada: z.string(),
      duracao_min: z.number(),
      baldeacoes: z.number(),
      caminhada_metros: z.number(),
      trechos: z.array(
        z.object({
          modo: z.enum(['walk', 'bus', 'trolleybus', 'subway', 'rail', 'tram', 'ferry']),
          linha: z.string().nullable(),
          sentido: z.string().nullable(),
          de: z.string(),
          para: z.string(),
          parada_embarque: z.string().nullable(),
          saida: z.string(),
          chegada: z.string(),
          duracao_min: z.number(),
          distancia_metros: z.number(),
          paradas_intermediarias: z.number(),
          tempo_real: z.boolean(),
        }),
      ),
    }),
  ),
};

type PlaceOutput = z.infer<typeof placeOutput>;

const COORDINATES = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

// Artigo e nome do veículo para "Pegue o ônibus", "Pegue a balsa".
const VEHICLE: Record<Exclude<TripMode, 'walk'>, string> = {
  bus: 'o ônibus',
  trolleybus: 'o trólebus',
  subway: 'o metrô',
  rail: 'o trem',
  tram: 'o VLT',
  ferry: 'a balsa',
};

@Injectable()
export class PlanTripTool extends McpTool {
  readonly name = 'planejar_viagem';
  private readonly logger = new Logger(PlanTripTool.name);

  constructor(
    private readonly searchPlaces: SearchPlacesUseCase,
    private readonly planTrip: PlanTripUseCase,
  ) {
    super();
  }

  register(server: McpServer): void {
    server.registerTool(
      this.name,
      {
        title: 'Planejar viagem',
        description:
          'Planeja uma viagem de transporte público (ônibus, metrô e trem, com caminhada) entre dois lugares ' +
          'informados em texto, saindo agora, a partir de uma hora ou para chegar até uma hora ' +
          '(ex.: "Como chego do Tatuapé à Paulista saindo às 8h?"). Devolve as opções com duração, ' +
          'horários, baldeações e cada trecho.',
        inputSchema,
        outputSchema,
        annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
      },
      ({ origem, destino, saida, chegada, opcoes, cidade }) =>
        runTool(this.logger, this.name, async () => {
          const city = resolveCity(cidade);
          if (!city) return toolError(unsupportedCityMessage(cidade));

          const from = await this.locate(origem);
          if (!from) return toolError(notFound('a origem', origem));
          const to = await this.locate(destino);
          if (!to) return toolError(notFound('o destino', destino));

          const { itineraries } = await this.planTrip.execute({
            from: { lat: from.latitude, lon: from.longitude },
            to: { lat: to.latitude, lon: to.longitude },
            departAt: saida ? toTripDateTime(saida, city.timeZone) : undefined,
            arriveBy: chegada ? toTripDateTime(chegada, city.timeZone) : undefined,
            maxItineraries: opcoes,
          });
          const structured = {
            cidade: city.name,
            origem: from,
            destino: to,
            itinerarios: itineraries.map(toItineraryOutput),
          };

          const route = `de ${from.nome} para ${to.nome}`;
          if (itineraries.length === 0) {
            return toolText(
              `Não encontrei itinerário de transporte público ${route} nesse horário. ` +
                'Tente outro horário ou lugares mais próximos de uma linha.',
              structured,
            );
          }
          const blocks = itineraries.map((it, i) => describeItinerary(it, i + 1, city.timeZone));
          const header =
            itineraries.length === 1
              ? `1 opção ${route}:`
              : `${itineraries.length} opções ${route}:`;
          return toolText([header, ...blocks].join('\n\n'), structured);
        }),
    );
  }

  /** Primeiro resultado da geocodificação, ou a coordenada digitada. */
  private async locate(text: string): Promise<PlaceOutput | null> {
    const coords = COORDINATES.exec(text);
    if (coords) {
      return {
        nome: text.trim(),
        endereco: null,
        latitude: Number(coords[1]),
        longitude: Number(coords[2]),
      };
    }
    const { places } = await this.searchPlaces.execute({ query: text });
    const place = places[0];
    if (!place) return null;
    return {
      nome: place.name,
      endereco: place.address,
      latitude: place.location.lat,
      longitude: place.location.lon,
    };
  }
}

function notFound(which: string, text: string): string {
  return (
    `Não encontrei ${which} "${text}". Informe um endereço mais específico, ` +
    'com número e bairro (ex.: "Av. Paulista, 1578, Bela Vista"), ou o nome de uma estação.'
  );
}

function minutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function formatDuration(seconds: number): string {
  const total = minutes(seconds);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

function describeItinerary(it: Itinerary, index: number, timeZone: string): string {
  const transfers =
    it.transfers === 0 ? 'sem baldeação' : plural(it.transfers, 'baldeação', 'baldeações');
  const header =
    `Opção ${index}: ${formatDuration(it.durationS)}, saída ${formatClock(it.startAt, timeZone)}, ` +
    `chegada ${formatClock(it.endAt, timeZone)}, ${transfers}, ${formatDistance(it.walkDistanceM)} a pé.`;
  const steps = it.legs.map((leg, i) => `${i + 1}. ${describeLeg(leg, timeZone)}`);
  return [header, ...steps].join('\n');
}

function describeLeg(leg: Leg, timeZone: string): string {
  if (leg.mode === 'walk') {
    return `Caminhe ${formatDistance(leg.distanceM)} até ${leg.to.name} (${formatDuration(leg.durationS)}).`;
  }
  const line = leg.routeShortName ? ` ${leg.routeShortName}` : '';
  const direction = leg.headsign ? ` sentido ${leg.headsign}` : '';
  const stops =
    leg.intermediateStops > 0
      ? `, ${plural(leg.intermediateStops, 'parada', 'paradas')} no caminho`
      : '';
  const realtime = leg.isRealtime ? ', horário em tempo real' : '';
  return (
    `Pegue ${VEHICLE[leg.mode]}${line}${direction} em ${leg.from.name} às ${formatClock(leg.startAt, timeZone)}` +
    ` e desça em ${leg.to.name} às ${formatClock(leg.endAt, timeZone)}` +
    ` (${formatDuration(leg.durationS)}${stops}${realtime}).`
  );
}

function toItineraryOutput(it: Itinerary) {
  return {
    saida: it.startAt,
    chegada: it.endAt,
    duracao_min: minutes(it.durationS),
    baldeacoes: it.transfers,
    caminhada_metros: Math.round(it.walkDistanceM),
    trechos: it.legs.map((leg) => ({
      modo: leg.mode,
      linha: leg.routeShortName,
      sentido: leg.headsign,
      de: leg.from.name,
      para: leg.to.name,
      parada_embarque: leg.mode === 'walk' ? null : leg.from.stopId,
      saida: leg.startAt,
      chegada: leg.endAt,
      duracao_min: minutes(leg.durationS),
      distancia_metros: Math.round(leg.distanceM),
      paradas_intermediarias: leg.intermediateStops,
      tempo_real: leg.isRealtime,
    })),
  };
}
