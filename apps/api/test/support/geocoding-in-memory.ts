// Adaptadores em memória do contexto geocoding (testes de caso de uso e de HTTP).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Coordinates, Place } from '../../src/modules/geocoding/domain/entities/place.entity';
import { GeocodeCache } from '../../src/modules/geocoding/domain/ports/geocode-cache.port';
import {
  type KnownPlaceMatch,
  type KnownPlaceRecord,
  KnownPlaceRepository,
} from '../../src/modules/geocoding/domain/ports/known-place-repository.port';
import { haversineM } from './transit-in-memory';

export const NOMINATIM_FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'nominatim');

export function readNominatimFixture(name: string): string {
  return readFileSync(join(NOMINATIM_FIXTURES_DIR, name), 'utf8');
}

/** Cache em memória com relógio controlável (`nowMs`). */
export class InMemoryGeocodeCache extends GeocodeCache {
  readonly entries = new Map<string, { query: string; places: Place[]; expiresAtMs: number }>();
  nowMs = 0;

  get(key: string): Promise<Place[] | null> {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAtMs <= this.nowMs) return Promise.resolve(null);
    return Promise.resolve(entry.places);
  }

  set(key: string, query: string, places: Place[], ttlSeconds: number): Promise<void> {
    this.entries.set(key, { query, places, expiresAtMs: this.nowMs + ttlSeconds * 1000 });
    return Promise.resolve();
  }
}

/** Nominatim falso: devolve `body` e grava cada URL e cabeçalhos pedidos. */
export function fakeNominatimFetch(
  body: string,
  status = 200,
): typeof fetch & { calls: Array<{ url: URL; headers: Headers; atMs: number }> } {
  const calls: Array<{ url: URL; headers: Headers; atMs: number }> = [];
  const fn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push({ url, headers: new Headers(init?.headers), atMs: Date.now() });
    return Promise.resolve(
      new Response(body, { status, headers: { 'Content-Type': 'application/json' } }),
    );
  }) as typeof fetch & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Lugar conhecido para o repositório em memória; o que faltar recebe valor neutro. */
export type KnownPlaceSeed = Pick<KnownPlaceMatch, 'place' | 'importance'> &
  Partial<Omit<KnownPlaceMatch, 'place' | 'importance'>>;

/**
 * Lugares conhecidos em memória (busca por trecho do nome ou apelido, sem acento).
 * `cityTest` decide quem fica dentro do município (padrão: ninguém sabe, null).
 */
export class InMemoryKnownPlaceRepository extends KnownPlaceRepository {
  readonly replaced: KnownPlaceRecord[][] = [];
  readonly boundaries: Array<string | null> = [];
  private readonly places: KnownPlaceMatch[];

  constructor(
    seeds: KnownPlaceSeed[] = [],
    private readonly cityTest: ((point: Coordinates) => boolean) | null = null,
  ) {
    super();
    this.places = seeds.map((seed) => ({
      category: '',
      aliases: [],
      inCity: cityTest ? cityTest(seed.place.location) : null,
      ...seed,
    }));
  }

  searchByName(text: string, limit: number): Promise<KnownPlaceMatch[]> {
    const needle = fold(text);
    return Promise.resolve(
      this.places
        .filter((match) =>
          [match.place.name, ...match.aliases].some((name) => fold(name).includes(needle)),
        )
        .sort((a, b) => b.importance - a.importance)
        .slice(0, limit),
    );
  }

  findNearest(
    center: Coordinates,
    radiusM: number,
  ): Promise<{ place: Place; distanceM: number } | null> {
    const nearest = this.places
      .map((match) => ({ place: match.place, distanceM: haversineM(center, match.place.location) }))
      .filter((found) => found.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM)[0];
    return Promise.resolve(nearest ?? null);
  }

  inServiceCity(points: Coordinates[]): Promise<Array<boolean | null>> {
    const test = this.cityTest;
    return Promise.resolve(points.map((point) => (test ? test(point) : null)));
  }

  replaceAll(records: KnownPlaceRecord[], cityBoundaryGeoJson: string | null): Promise<number> {
    this.replaced.push(records);
    this.boundaries.push(cityBoundaryGeoJson);
    return Promise.resolve(records.length);
  }
}
