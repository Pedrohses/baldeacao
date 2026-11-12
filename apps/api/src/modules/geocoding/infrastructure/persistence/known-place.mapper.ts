import { Place } from '../../domain/entities/place.entity';

/** Linha de `places` como as consultas a devolvem. */
export interface KnownPlaceRow {
  osm_id: string;
  name: string;
  address: string | null;
  importance: number | string;
  lat: number | string;
  lon: number | string;
}

export const KnownPlaceMapper = {
  toDomain(row: KnownPlaceRow): Place {
    return new Place({
      id: row.osm_id,
      name: row.name,
      address: row.address,
      kind: 'poi',
      location: { lat: Number(row.lat), lon: Number(row.lon) },
    });
  },
};
