import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { VehiclePosition } from '@baldeacao/types';
import { ClockPort } from '../../src/modules/realtime/domain/ports/clock.port';
import {
  PositionsCycleNotifierPort,
  type PositionsCycleEvent,
  type PositionsCycleListener,
} from '../../src/modules/realtime/domain/ports/positions-cycle-notifier.port';
import { VehiclePositionsSourcePort } from '../../src/modules/realtime/domain/ports/vehicle-positions-source.port';
import {
  VehiclePositionsStorePort,
  type StoredPositions,
} from '../../src/modules/realtime/domain/ports/vehicle-positions-store.port';
import type { OlhoVivoRawPositions } from '../../src/shared/infrastructure/olho-vivo/olho-vivo.types';

export const OLHO_VIVO_FIXTURES = resolve(__dirname, '../fixtures/olho-vivo');

export function readOlhoVivoFixture(name: string): string {
  return readFileSync(resolve(OLHO_VIVO_FIXTURES, `${name}.json`), 'utf8');
}

export function rawPositionsFixture(): OlhoVivoRawPositions {
  return JSON.parse(readOlhoVivoFixture('posicao')) as OlhoVivoRawPositions;
}

export class InMemoryPositionsSource extends VehiclePositionsSourcePort {
  constructor(
    public result: VehiclePosition[] | Error,
    readonly sourceId = 'sptrans',
  ) {
    super();
  }

  fetchPositions(): Promise<VehiclePosition[]> {
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

export class InMemoryPositionsStore extends VehiclePositionsStorePort {
  readonly data = new Map<string, StoredPositions>();

  replace(sourceId: string, vehicles: VehiclePosition[], updatedAt: string): Promise<void> {
    this.data.set(sourceId, { updatedAt, vehicles: [...vehicles] });
    return Promise.resolve();
  }

  read(sourceId: string): Promise<StoredPositions> {
    return Promise.resolve(this.data.get(sourceId) ?? { updatedAt: null, vehicles: [] });
  }
}

export class InMemoryCycleNotifier extends PositionsCycleNotifierPort {
  readonly published: PositionsCycleEvent[] = [];
  private readonly listeners = new Set<PositionsCycleListener>();

  publish(event: PositionsCycleEvent): Promise<void> {
    this.published.push(event);
    for (const listener of this.listeners) listener(event);
    return Promise.resolve();
  }

  subscribe(listener: PositionsCycleListener): Promise<() => Promise<void>> {
    this.listeners.add(listener);
    return Promise.resolve(() => {
      this.listeners.delete(listener);
      return Promise.resolve();
    });
  }
}

export class FixedClock extends ClockPort {
  constructor(public current = new Date('2026-11-12T15:34:30.000Z')) {
    super();
  }

  now(): Date {
    return this.current;
  }
}
