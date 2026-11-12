// Adaptadores em memória do contexto geocoding (testes de caso de uso e de HTTP).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Place } from '../../src/modules/geocoding/domain/entities/place.entity';
import { GeocodeCache } from '../../src/modules/geocoding/domain/ports/geocode-cache.port';

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
