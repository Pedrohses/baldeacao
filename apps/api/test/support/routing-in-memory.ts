// Apoio aos testes do contexto routing: fixtures do OTP e planejador em memória.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Itinerary } from '../../src/modules/routing/domain/entities/itinerary.entity';
import { Clock } from '../../src/modules/routing/domain/ports/clock.port';
import { TripPlanner } from '../../src/modules/routing/domain/ports/trip-planner.port';
import type { TripPlanQuery } from '../../src/modules/routing/domain/value-objects/trip-plan-query';

export const OTP_FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'otp');

export function readOtpFixture(name: string): string {
  return readFileSync(join(OTP_FIXTURES_DIR, name), 'utf8');
}

/** OTP falso: responde `body` e grava URL e corpo JSON de cada POST. */
export function fakeOtpFetch(
  body: string,
  status = 200,
): typeof fetch & { calls: Array<{ url: string; body: unknown }> } {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, body: JSON.parse(typeof init?.body === 'string' ? init.body : 'null') });
    return Promise.resolve(
      new Response(body, { status, headers: { 'Content-Type': 'application/json' } }),
    );
  }) as typeof fetch & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}

export class InMemoryTripPlanner extends TripPlanner {
  readonly queries: TripPlanQuery[] = [];
  constructor(private readonly result: Itinerary[] | Error = []) {
    super();
  }
  plan(query: TripPlanQuery): Promise<Itinerary[]> {
    this.queries.push(query);
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

/** Relógio parado em `iso` (padrão: 12/11/2026 às 07:00 em São Paulo). */
export class FixedClock extends Clock {
  constructor(private readonly iso = '2026-11-12T07:00:00-03:00') {
    super();
  }

  now(): Date {
    return new Date(this.iso);
  }
}
