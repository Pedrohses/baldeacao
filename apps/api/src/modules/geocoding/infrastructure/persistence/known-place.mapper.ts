import { Place, type PlaceKind } from '../../domain/entities/place.entity';

/** Linha de `places` como as consultas a devolvem. */
export interface KnownPlaceRow {
  osm_id: string;
  name: string;
  kind?: string | null;
  category?: string | null;
  aliases?: string | null;
  in_city?: boolean | null;
  address: string | null;
  importance: number | string;
  lat: number | string;
  lon: number | string;
}

/** Separador dos nomes alternativos na coluna `aliases`. */
export const ALIASES_SEPARATOR = '|';

const KINDS: ReadonlySet<string> = new Set(['poi', 'station', 'address']);

export const KnownPlaceMapper = {
  toDomain(row: KnownPlaceRow): Place {
    const kind = row.kind && KINDS.has(row.kind) ? (row.kind as PlaceKind) : 'poi';
    return new Place({
      id: row.osm_id,
      name: row.name,
      address: row.address,
      kind,
      location: { lat: Number(row.lat), lon: Number(row.lon) },
    });
  },

  aliases(row: KnownPlaceRow): string[] {
    return (row.aliases ?? '')
      .split(ALIASES_SEPARATOR)
      .map((alias) => alias.trim())
      .filter(Boolean);
  },
};
