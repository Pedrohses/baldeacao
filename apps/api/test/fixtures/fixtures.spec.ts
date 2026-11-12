import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  ArrivalSchema,
  LineShapeSchema,
  PositionsSubscriptionSchema,
  PositionsUpdateSchema,
  RouteSchema,
  StopSchema,
  VehiclePositionSchema,
  VehicleSnapshotSchema,
} from '@baldeacao/types';
import {
  arrivalExample,
  lineShapeExample,
  positionsSubscriptionExample,
  positionsUpdateExample,
  routeExample,
  stopExample,
  vehiclePositionExample,
  vehicleSnapshotExample,
} from '../../../../packages/types/src/__examples__';

const GTFS_DIR = join(__dirname, 'gtfs', 'sptrans-mini');
const OLHO_VIVO_DIR = join(__dirname, 'olho-vivo');

type Row = Record<string, string>;

// CSV simples: sem aspas e sem vírgula dentro de campos (garantido por um teste abaixo).
function readCsv(name: string): { header: string[]; rows: Row[] } {
  const text = readFileSync(join(GTFS_DIR, name), 'utf8');
  const [headerLine = '', ...lines] = text.split('\n').filter((line) => line.length > 0);
  const header = headerLine.split(',');
  const rows = lines.map((line) => {
    const cells = line.split(',');
    expect(cells).toHaveLength(header.length);
    return Object.fromEntries(
      header.map((column, i): [string, string] => [column, cells[i] ?? '']),
    );
  });
  return { header, rows };
}

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(OLHO_VIVO_DIR, name), 'utf8')) as unknown;
}

const REQUIRED_COLUMNS: Record<string, string[]> = {
  'agency.txt': ['agency_id', 'agency_name', 'agency_url', 'agency_timezone'],
  'routes.txt': ['route_id', 'route_short_name', 'route_long_name', 'route_type'],
  'stops.txt': ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
  'trips.txt': ['route_id', 'service_id', 'trip_id', 'direction_id', 'shape_id'],
  'stop_times.txt': ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
  'calendar.txt': ['service_id', 'monday', 'sunday', 'start_date', 'end_date'],
  'frequencies.txt': ['trip_id', 'start_time', 'end_time', 'headway_secs'],
  'shapes.txt': ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence'],
};

describe('GTFS sptrans-mini', () => {
  const files = Object.keys(REQUIRED_COLUMNS);
  const data = Object.fromEntries(files.map((name) => [name, readCsv(name)]));
  const rowsOf = (name: string): Row[] => data[name]?.rows ?? [];
  const column = (name: string, key: string): Set<string> =>
    new Set(rowsOf(name).map((row) => row[key] ?? ''));

  it.each(files)('%s tem os cabeçalhos obrigatórios e linhas', (name) => {
    expect(data[name]?.header).toEqual(expect.arrayContaining(REQUIRED_COLUMNS[name] ?? []));
    expect(rowsOf(name).length).toBeGreaterThan(0);
  });

  it.each(files)('%s não usa aspas nem vírgula dentro de campos', (name) => {
    expect(readFileSync(join(GTFS_DIR, name), 'utf8')).not.toContain('"');
  });

  it('liga trips a routes, calendar e shapes', () => {
    const routes = column('routes.txt', 'route_id');
    const services = column('calendar.txt', 'service_id');
    const shapes = column('shapes.txt', 'shape_id');
    for (const trip of rowsOf('trips.txt')) {
      expect(routes).toContain(trip['route_id']);
      expect(services).toContain(trip['service_id']);
      expect(shapes).toContain(trip['shape_id']);
      expect(['0', '1']).toContain(trip['direction_id']);
    }
  });

  it('liga stop_times a stops e trips, com sequência crescente', () => {
    const stops = column('stops.txt', 'stop_id');
    const trips = column('trips.txt', 'trip_id');
    const last = new Map<string, number>();
    for (const time of rowsOf('stop_times.txt')) {
      const tripId = time['trip_id'] ?? '';
      expect(trips).toContain(tripId);
      expect(stops).toContain(time['stop_id']);
      const sequence = Number(time['stop_sequence']);
      expect(sequence).toBeGreaterThan(last.get(tripId) ?? 0);
      last.set(tripId, sequence);
    }
    expect([...last.keys()].sort()).toEqual([...trips].sort());
  });

  it('liga frequencies a trips e deixa pelo menos uma viagem sem frequência', () => {
    const trips = column('trips.txt', 'trip_id');
    const withFrequency = column('frequencies.txt', 'trip_id');
    for (const id of withFrequency) expect(trips).toContain(id);
    expect(withFrequency.size).toBeLessThan(trips.size);
  });

  it('tem um shape por sentido de cada linha, com coordenadas em São Paulo', () => {
    const trips = rowsOf('trips.txt');
    expect(new Set(trips.map((t) => t['shape_id'])).size).toBe(trips.length);
    for (const point of [...rowsOf('shapes.txt'), ...rowsOf('stops.txt')]) {
      const lat = Number(point['shape_pt_lat'] ?? point['stop_lat']);
      const lon = Number(point['shape_pt_lon'] ?? point['stop_lon']);
      expect(lat).toBeGreaterThan(-24.1);
      expect(lat).toBeLessThan(-23.3);
      expect(lon).toBeGreaterThan(-47);
      expect(lon).toBeLessThan(-46.3);
    }
  });

  describe('coerência com a Olho Vivo', () => {
    const VehicleSchema = z.object({
      p: z.union([z.number(), z.string()]),
      a: z.boolean(),
      ta: z.iso.datetime(),
      py: z.number(),
      px: z.number(),
      t: z.string().optional(),
    });
    const LineSchema = z.object({
      c: z.string(),
      cl: z.number(),
      sl: z.union([z.literal(1), z.literal(2)]),
      lt0: z.string(),
      lt1: z.string(),
      qv: z.number(),
      vs: z.array(VehicleSchema),
    });
    const routes = column('routes.txt', 'route_id');
    const stops = column('stops.txt', 'stop_id');

    it('posicao.json usa linhas do recorte e qv confere com vs', () => {
      const parsed = z
        .object({ hr: z.string(), l: z.array(LineSchema) })
        .parse(readJson('posicao.json'));
      for (const line of parsed.l) {
        expect(routes).toContain(line.c);
        expect(line.qv).toBe(line.vs.length);
      }
    });

    it('posicao-linha.json tem hr e veículos que existem em posicao.json', () => {
      const parsed = z
        .object({ hr: z.string(), vs: z.array(VehicleSchema) })
        .parse(readJson('posicao-linha.json'));
      const all = z.object({ l: z.array(LineSchema) }).parse(readJson('posicao.json'));
      const line = all.l.find((l) => l.cl === 1090);
      expect(parsed.vs).toEqual(line?.vs);
    });

    it('previsao-parada.json aponta para uma parada e linhas do recorte', () => {
      const parsed = z
        .object({
          hr: z.string(),
          p: z.object({
            cp: z.number(),
            np: z.string(),
            py: z.number(),
            px: z.number(),
            l: z.array(LineSchema),
          }),
        })
        .parse(readJson('previsao-parada.json'));
      expect(stops).toContain(String(parsed.p.cp));
      for (const line of parsed.p.l) {
        expect(routes).toContain(line.c);
        expect(line.qv).toBe(line.vs.length);
        for (const vehicle of line.vs) expect(vehicle.t).toMatch(/^\d{2}:\d{2}$/);
      }
    });

    it('linha-buscar.json lista linhas do recorte', () => {
      const parsed = z
        .array(
          z.object({
            cl: z.number(),
            lc: z.boolean(),
            lt: z.string(),
            sl: z.union([z.literal(1), z.literal(2)]),
            tl: z.number(),
            tp: z.string(),
            ts: z.string(),
          }),
        )
        .parse(readJson('linha-buscar.json'));
      expect(parsed.length).toBeGreaterThan(0);
      for (const line of parsed) expect(routes).toContain(`${line.lt}-${line.tl}`);
    });

    it('as respostas de login e erro continuam parseáveis', () => {
      expect(readJson('login-ok.json')).toBe(true);
      expect(readJson('login-recusado.json')).toBe(false);
      expect(
        z.object({ Message: z.string() }).parse(readJson('unauthorized-401.json')),
      ).toBeDefined();
    });
  });

  describe('exemplos dos contratos', () => {
    it('passam nos schemas de @baldeacao/types', () => {
      expect(RouteSchema.parse(routeExample)).toEqual(routeExample);
      expect(StopSchema.parse(stopExample)).toEqual(stopExample);
      expect(LineShapeSchema.parse(lineShapeExample)).toEqual(lineShapeExample);
      expect(ArrivalSchema.parse(arrivalExample)).toEqual(arrivalExample);
      expect(VehiclePositionSchema.parse(vehiclePositionExample)).toEqual(vehiclePositionExample);
      expect(VehicleSnapshotSchema.parse(vehicleSnapshotExample)).toEqual(vehicleSnapshotExample);
      expect(PositionsSubscriptionSchema.parse(positionsSubscriptionExample)).toEqual(
        positionsSubscriptionExample,
      );
      expect(PositionsUpdateSchema.parse(positionsUpdateExample)).toEqual(positionsUpdateExample);
    });

    it('falam dos mesmos dados do recorte GTFS', () => {
      const route = rowsOf('routes.txt').find((r) => r['route_id'] === routeExample.id);
      expect(route?.['route_long_name']).toBe(routeExample.longName);
      expect(route?.['route_color']).toBe(routeExample.color);

      const stop = rowsOf('stops.txt').find((s) => s['stop_id'] === stopExample.id);
      expect(stop?.['stop_name']).toBe(stopExample.name);
      expect(Number(stop?.['stop_lat'])).toBeCloseTo(stopExample.location.lat, 4);
      expect(Number(stop?.['stop_lon'])).toBeCloseTo(stopExample.location.lon, 4);

      const shape = rowsOf('shapes.txt').filter((s) => s['shape_id'] === lineShapeExample.shapeId);
      lineShapeExample.points.forEach((point, i) => {
        expect(Number(shape[i]?.['shape_pt_lat'])).toBeCloseTo(point.lat, 4);
        expect(Number(shape[i]?.['shape_pt_lon'])).toBeCloseTo(point.lon, 4);
      });
      const trip = rowsOf('trips.txt').find((t) => t['shape_id'] === lineShapeExample.shapeId);
      expect(trip?.['route_id']).toBe(lineShapeExample.routeId);
      expect(Number(trip?.['direction_id'])).toBe(lineShapeExample.directionId);

      expect(arrivalExample.stopId).toBe(stopExample.id);
      expect(arrivalExample.routeId).toBe(routeExample.id);
    });
  });
});
