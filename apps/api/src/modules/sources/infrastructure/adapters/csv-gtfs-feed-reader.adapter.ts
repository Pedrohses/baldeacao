import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse';
import type {
  GtfsCalendar,
  GtfsFrequency,
  GtfsRoute,
  GtfsShapePoint,
  GtfsStop,
  GtfsStopTime,
  GtfsTrip,
  RawGtfsFeed,
} from '../../domain/entities/gtfs-feed.entity';
import { InvalidGtfsFeedError } from '../../domain/errors/invalid-gtfs-feed.error';
import { GtfsFeedReader } from '../../domain/ports/gtfs-feed-reader.port';
import {
  parseGtfsBoolean,
  parseGtfsColor,
  parseGtfsDate,
  parseGtfsDirection,
  parseGtfsTime,
} from '../../domain/value-objects/gtfs-values';

type Row = Record<string, string | undefined>;

const REQUIRED_FILES = ['routes.txt', 'stops.txt', 'trips.txt', 'stop_times.txt'] as const;

/** Lê um GTFS descompactado numa pasta, em fluxo, arquivo por arquivo. */
@Injectable()
export class CsvGtfsFeedReader extends GtfsFeedReader {
  async open(location: string): Promise<RawGtfsFeed> {
    const info = await stat(location).catch(() => undefined);
    if (!info?.isDirectory()) {
      throw new InvalidGtfsFeedError(`Pasta do GTFS não encontrada: ${location}`);
    }
    for (const file of REQUIRED_FILES) {
      if (!(await exists(join(location, file)))) {
        throw new InvalidGtfsFeedError(`Arquivo obrigatório ausente no GTFS: ${file}`);
      }
    }

    const file = (name: string) => new GtfsFile(join(location, name), name);
    return {
      routes: () => file('routes.txt').map(toRoute),
      stops: () => file('stops.txt').map(toStop),
      trips: () => file('trips.txt').map(toTrip),
      stopTimes: () => file('stop_times.txt').map(toStopTime),
      calendar: () => file('calendar.txt').optional().map(toCalendar),
      frequencies: () => file('frequencies.txt').optional().map(toFrequency),
      shapePoints: () => file('shapes.txt').optional().map(toShapePoint),
    };
  }
}

class GtfsFile {
  private isOptional = false;

  constructor(
    private readonly path: string,
    private readonly name: string,
  ) {}

  optional(): this {
    this.isOptional = true;
    return this;
  }

  async *map<T>(convert: (field: FieldReader) => T): AsyncIterable<T> {
    if (this.isOptional && !(await exists(this.path))) return;

    const parser = createReadStream(this.path).pipe(
      parse({ columns: true, bom: true, skip_empty_lines: true, trim: true, info: true }),
    );
    for await (const record of parser as AsyncIterable<{ record: Row; info: { lines: number } }>) {
      yield convert(new FieldReader(this.name, record.info.lines, record.record));
    }
  }
}

/** Lê campos de uma linha com mensagens de erro que apontam arquivo e linha. */
class FieldReader {
  constructor(
    private readonly file: string,
    private readonly line: number,
    private readonly row: Row,
  ) {}

  text(column: string): string {
    const value = this.row[column];
    if (value === undefined || value === '') this.fail(column, 'obrigatório');
    return value;
  }

  optionalText(column: string): string | null {
    const value = this.row[column];
    return value === undefined || value === '' ? null : value;
  }

  number(column: string): number {
    const value = Number(this.text(column));
    if (!Number.isFinite(value)) this.fail(column, 'não é número');
    return value;
  }

  integer(column: string): number {
    const value = this.number(column);
    if (!Number.isInteger(value)) this.fail(column, 'não é inteiro');
    return value;
  }

  time(column: string): number {
    return this.parsed(column, parseGtfsTime(this.text(column)), 'hora inválida');
  }

  optionalTime(column: string): number | null {
    const value = this.optionalText(column);
    return value === null ? null : this.parsed(column, parseGtfsTime(value), 'hora inválida');
  }

  date(column: string): string {
    return this.parsed(column, parseGtfsDate(this.text(column)), 'data inválida');
  }

  flag(column: string): boolean {
    return this.parsed(column, parseGtfsBoolean(this.text(column)), 'esperado 0 ou 1');
  }

  raw(column: string): string | undefined {
    return this.row[column];
  }

  private parsed<T>(column: string, value: T | undefined, reason: string): T {
    if (value === undefined) this.fail(column, reason);
    return value;
  }

  private fail(column: string, reason: string): never {
    throw new InvalidGtfsFeedError(`${this.file}, linha ${this.line}: ${column} ${reason}.`);
  }
}

function toRoute(f: FieldReader): GtfsRoute {
  const routeId = f.text('route_id');
  const shortName = f.optionalText('route_short_name');
  const longName = f.optionalText('route_long_name');
  return {
    routeId,
    agencyId: f.optionalText('agency_id'),
    // O GTFS exige um dos dois nomes; o letreiro cai para o id quando falta.
    shortName: shortName ?? routeId,
    longName: longName ?? '',
    routeType: f.integer('route_type'),
    color: parseGtfsColor(f.raw('route_color')),
    textColor: parseGtfsColor(f.raw('route_text_color')),
  };
}

function toStop(f: FieldReader): GtfsStop {
  return {
    stopId: f.text('stop_id'),
    code: f.optionalText('stop_code'),
    name: f.text('stop_name'),
    description: f.optionalText('stop_desc'),
    lat: f.number('stop_lat'),
    lon: f.number('stop_lon'),
  };
}

function toTrip(f: FieldReader): GtfsTrip {
  return {
    tripId: f.text('trip_id'),
    routeId: f.text('route_id'),
    serviceId: f.text('service_id'),
    headsign: f.optionalText('trip_headsign'),
    directionId: parseGtfsDirection(f.raw('direction_id')),
    shapeId: f.optionalText('shape_id'),
  };
}

function toStopTime(f: FieldReader): GtfsStopTime {
  return {
    tripId: f.text('trip_id'),
    stopId: f.text('stop_id'),
    stopSequence: f.integer('stop_sequence'),
    arrivalTime: f.optionalTime('arrival_time'),
    departureTime: f.optionalTime('departure_time'),
  };
}

function toCalendar(f: FieldReader): GtfsCalendar {
  return {
    serviceId: f.text('service_id'),
    monday: f.flag('monday'),
    tuesday: f.flag('tuesday'),
    wednesday: f.flag('wednesday'),
    thursday: f.flag('thursday'),
    friday: f.flag('friday'),
    saturday: f.flag('saturday'),
    sunday: f.flag('sunday'),
    startDate: f.date('start_date'),
    endDate: f.date('end_date'),
  };
}

function toFrequency(f: FieldReader): GtfsFrequency {
  return {
    tripId: f.text('trip_id'),
    startTime: f.time('start_time'),
    endTime: f.time('end_time'),
    headwaySecs: f.integer('headway_secs'),
  };
}

function toShapePoint(f: FieldReader): GtfsShapePoint {
  return {
    shapeId: f.text('shape_id'),
    lat: f.number('shape_pt_lat'),
    lon: f.number('shape_pt_lon'),
    sequence: f.integer('shape_pt_sequence'),
  };
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}
