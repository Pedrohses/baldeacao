import { CoordinatesSchema, PlaceKindSchema, type Place } from '@baldeacao/types';
import { z } from 'zod';

import { MAP_POINT_NAME } from '@/shared/utils/place';

export const TRIP_PATH = '/viagem';
/** Valor de `de`/`para` que pede a posição atual do aparelho. */
export const CURRENT_LOCATION_PARAM = 'minha-localizacao';

/** Ponta da viagem vinda da URL: um lugar ou "minha localização" (resolvida pelo GPS na tela). */
export type TripEndpoint = Place | 'current-location';
export type TripFocus = 'origin' | 'destination';

export interface TripLink {
  from?: TripEndpoint | null;
  to?: TripEndpoint | null;
  focus?: TripFocus;
}

export interface ParsedTripParams {
  origin: TripEndpoint | null;
  destination: TripEndpoint | null;
  focus: TripFocus | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

const PREFIX = { from: 'de', to: 'para' } as const;

const LatLonSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
  .transform((value) => {
    const [lat, lon] = value.split(',').map(Number);
    return { lat, lon };
  })
  .pipe(CoordinatesSchema);

const NameSchema = z.string().trim().min(1).max(200);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function writeEndpoint(params: URLSearchParams, prefix: string, endpoint: TripEndpoint) {
  if (endpoint === 'current-location') {
    params.set(prefix, CURRENT_LOCATION_PARAM);
    return;
  }
  const { lat, lon } = endpoint.location;
  params.set(prefix, `${lat.toFixed(6)},${lon.toFixed(6)}`);
  params.set(`${prefix}Nome`, endpoint.name);
  params.set(`${prefix}Tipo`, endpoint.kind);
}

/** Link para /viagem com origem e destino, ex.: `/viagem?para=-23.5,-46.6&paraNome=Sé&paraTipo=stop`. */
export function buildTripHref({ from, to, focus }: TripLink = {}): string {
  const params = new URLSearchParams();
  if (from) writeEndpoint(params, PREFIX.from, from);
  if (to) writeEndpoint(params, PREFIX.to, to);
  if (focus) params.set('foco', focus === 'destination' ? 'destino' : 'origem');
  const query = params.toString();
  return query ? `${TRIP_PATH}?${query}` : TRIP_PATH;
}

function readEndpoint(params: SearchParams, prefix: string): TripEndpoint | null {
  const raw = first(params[prefix]);
  if (!raw) return null;
  if (raw === CURRENT_LOCATION_PARAM) return 'current-location';
  const location = LatLonSchema.safeParse(raw);
  if (!location.success) return null;
  const name = NameSchema.safeParse(first(params[`${prefix}Nome`]));
  const kind = PlaceKindSchema.safeParse(first(params[`${prefix}Tipo`]));
  const resolvedKind = kind.success ? kind.data : 'coordinates';
  return {
    id: `url:${resolvedKind}:${location.data.lat},${location.data.lon}`,
    name: name.success ? name.data : MAP_POINT_NAME,
    address: null,
    kind: resolvedKind,
    location: location.data,
  };
}

/** Lê `de`, `para`, `deNome`, `paraNome`, `deTipo`, `paraTipo` e `foco`; o que não vale é ignorado. */
export function parseTripSearchParams(params: SearchParams): ParsedTripParams {
  const focus = first(params.foco);
  return {
    origin: readEndpoint(params, PREFIX.from),
    destination: readEndpoint(params, PREFIX.to),
    focus: focus === 'destino' ? 'destination' : focus === 'origem' ? 'origin' : null,
  };
}
