import { Place, type PlaceKind } from '../../domain/entities/place.entity';
import type { CachedPlaceJson } from './geocode-cache.orm-entity';

const KINDS: ReadonlySet<string> = new Set<PlaceKind>(['address', 'poi', 'stop', 'coordinates']);

function isCachedPlace(value: unknown): value is CachedPlaceJson {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<CachedPlaceJson>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    (v.address === null || typeof v.address === 'string') &&
    typeof v.kind === 'string' &&
    KINDS.has(v.kind) &&
    typeof v.location?.lat === 'number' &&
    typeof v.location?.lon === 'number'
  );
}

export const GeocodeCacheMapper = {
  toJson(places: Place[]): CachedPlaceJson[] {
    return places.map((place) => ({
      id: place.id,
      name: place.name,
      address: place.address,
      kind: place.kind,
      location: { lat: place.location.lat, lon: place.location.lon },
    }));
  },

  /** null quando o jsonb não tem o formato esperado (registro antigo ou corrompido). */
  toDomain(json: unknown): Place[] | null {
    if (!Array.isArray(json) || !json.every(isCachedPlace)) return null;
    return json.map(
      (item) =>
        new Place({
          id: item.id,
          name: item.name,
          address: item.address,
          kind: item.kind as PlaceKind,
          location: item.location,
        }),
    );
  },
};
