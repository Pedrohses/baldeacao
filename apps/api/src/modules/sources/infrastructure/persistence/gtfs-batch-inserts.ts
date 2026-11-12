import type {
  GtfsCalendar,
  GtfsFrequency,
  GtfsRoute,
  GtfsShape,
  GtfsStop,
  GtfsStopTime,
  GtfsTrip,
} from '../../domain/entities/gtfs-feed.entity';

/**
 * Um INSERT em lote: `$1` é sempre o source_id; `columns` devolve um array por coluna,
 * na ordem dos parâmetros `$2..$n` do unnest.
 */
export interface BatchInsert<T> {
  sql: string;
  columns(rows: T[]): unknown[][];
}

export const calendarInsert: BatchInsert<GtfsCalendar> = {
  sql: `INSERT INTO calendar (source_id, service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
    SELECT $1, * FROM unnest($2::text[], $3::bool[], $4::bool[], $5::bool[], $6::bool[], $7::bool[], $8::bool[], $9::bool[], $10::date[], $11::date[])`,
  columns: (rows) => [
    rows.map((r) => r.serviceId),
    rows.map((r) => r.monday),
    rows.map((r) => r.tuesday),
    rows.map((r) => r.wednesday),
    rows.map((r) => r.thursday),
    rows.map((r) => r.friday),
    rows.map((r) => r.saturday),
    rows.map((r) => r.sunday),
    rows.map((r) => r.startDate),
    rows.map((r) => r.endDate),
  ],
};

export const routesInsert: BatchInsert<GtfsRoute> = {
  sql: `INSERT INTO routes (source_id, route_id, agency_id, short_name, long_name, route_type, color, text_color)
    SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::smallint[], $7::text[], $8::text[])`,
  columns: (rows) => [
    rows.map((r) => r.routeId),
    rows.map((r) => r.agencyId),
    rows.map((r) => r.shortName),
    rows.map((r) => r.longName),
    rows.map((r) => r.routeType),
    rows.map((r) => r.color),
    rows.map((r) => r.textColor),
  ],
};

export const stopsInsert: BatchInsert<GtfsStop> = {
  sql: `INSERT INTO stops (source_id, stop_id, code, name, description, location)
    SELECT $1, t.stop_id, t.code, t.name, t.description,
      ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326)::geography
    FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::float8[], $7::float8[])
      AS t(stop_id, code, name, description, lon, lat)`,
  columns: (rows) => [
    rows.map((r) => r.stopId),
    rows.map((r) => r.code),
    rows.map((r) => r.name),
    rows.map((r) => r.description),
    rows.map((r) => r.lon),
    rows.map((r) => r.lat),
  ],
};

export const shapesInsert: BatchInsert<GtfsShape> = {
  sql: `INSERT INTO shapes (source_id, shape_id, path)
    SELECT $1, t.shape_id, ST_GeogFromText(t.wkt)
    FROM unnest($2::text[], $3::text[]) AS t(shape_id, wkt)`,
  columns: (rows) => [
    rows.map((r) => r.shapeId),
    rows.map((r) => `SRID=4326;LINESTRING(${r.points.map((p) => `${p.lon} ${p.lat}`).join(',')})`),
  ],
};

export const tripsInsert: BatchInsert<GtfsTrip> = {
  sql: `INSERT INTO trips (source_id, trip_id, route_id, service_id, headsign, direction_id, shape_id)
    SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::smallint[], $7::text[])`,
  columns: (rows) => [
    rows.map((r) => r.tripId),
    rows.map((r) => r.routeId),
    rows.map((r) => r.serviceId),
    rows.map((r) => r.headsign),
    rows.map((r) => r.directionId),
    rows.map((r) => r.shapeId),
  ],
};

export const stopTimesInsert: BatchInsert<GtfsStopTime> = {
  sql: `INSERT INTO stop_times (source_id, trip_id, stop_sequence, stop_id, arrival_time, departure_time)
    SELECT $1, * FROM unnest($2::text[], $3::int[], $4::text[], $5::int[], $6::int[])`,
  columns: (rows) => [
    rows.map((r) => r.tripId),
    rows.map((r) => r.stopSequence),
    rows.map((r) => r.stopId),
    rows.map((r) => r.arrivalTime),
    rows.map((r) => r.departureTime),
  ],
};

export const frequenciesInsert: BatchInsert<GtfsFrequency> = {
  sql: `INSERT INTO frequencies (source_id, trip_id, start_time, end_time, headway_secs)
    SELECT $1, * FROM unnest($2::text[], $3::int[], $4::int[], $5::int[])`,
  columns: (rows) => [
    rows.map((r) => r.tripId),
    rows.map((r) => r.startTime),
    rows.map((r) => r.endTime),
    rows.map((r) => r.headwaySecs),
  ],
};
