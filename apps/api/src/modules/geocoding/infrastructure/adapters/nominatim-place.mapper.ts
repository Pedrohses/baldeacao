import { Place, type PlaceKind } from '../../domain/entities/place.entity';
import type { NominatimSearchResult } from './nominatim.types';

const STOP_TYPES: Record<string, ReadonlySet<string>> = {
  highway: new Set(['bus_stop']),
  amenity: new Set(['bus_station']),
  railway: new Set(['station', 'halt', 'tram_stop', 'subway_entrance']),
  public_transport: new Set(['station', 'stop_position', 'platform', 'stop_area']),
};

// Categorias e addresstypes que são endereço (rua, número, bairro, cidade, CEP).
const ADDRESS_CATEGORIES = new Set(['highway', 'place', 'boundary', 'building']);
const ADDRESS_TYPES = new Set([
  'road',
  'house_number',
  'house',
  'postcode',
  'neighbourhood',
  'suburb',
  'quarter',
  'city_district',
  'city',
  'town',
  'village',
  'municipality',
  'state',
]);

function first(address: Record<string, string | undefined>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = address[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function kindOf(result: NominatimSearchResult): PlaceKind {
  if (STOP_TYPES[result.category]?.has(result.type)) return 'stop';
  if (ADDRESS_CATEGORIES.has(result.category)) return 'address';
  if (result.addresstype && ADDRESS_TYPES.has(result.addresstype) && !result.name?.trim()) {
    return 'address';
  }
  return 'poi';
}

/** "Rua X, 123" a partir dos detalhes de endereço; undefined sem rua. */
function streetLine(address: Record<string, string | undefined>): string | undefined {
  const street = first(address, ['road', 'pedestrian', 'footway', 'square', 'residential']);
  if (!street) return undefined;
  const number = address.house_number?.trim();
  return number ? `${street}, ${number}` : street;
}

/** Endereço curto: rua e número, bairro, cidade. Sem detalhes, o display_name inteiro. */
function addressOf(result: NominatimSearchResult): string | null {
  const address = result.address ?? {};
  const parts = [
    streetLine(address),
    first(address, ['suburb', 'neighbourhood', 'city_district', 'quarter']),
    first(address, ['city', 'town', 'village', 'municipality']),
  ].filter((part): part is string => Boolean(part));
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);
  if (unique.length > 0) return unique.join(', ');
  return result.display_name.trim() || null;
}

function nameOf(result: NominatimSearchResult): string {
  return (
    result.name?.trim() ||
    streetLine(result.address ?? {}) ||
    result.display_name.split(',')[0]?.trim() ||
    result.display_name
  );
}

export const NominatimPlaceMapper = {
  /** null quando o item não tem coordenada válida ou nome. */
  toDomain(result: NominatimSearchResult): Place | null {
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const name = nameOf(result);
    if (!name) return null;
    return new Place({
      id: `osm:${result.osm_type}:${result.osm_id}`,
      name,
      address: addressOf(result),
      kind: kindOf(result),
      location: { lat, lon },
    });
  },

  /** Lista na ordem do Nominatim, sem itens inválidos nem ids repetidos. */
  toDomainList(results: NominatimSearchResult[]): Place[] {
    const seen = new Set<string>();
    const places: Place[] = [];
    for (const result of results) {
      const place = NominatimPlaceMapper.toDomain(result);
      if (!place || seen.has(place.id)) continue;
      seen.add(place.id);
      places.push(place);
    }
    return places;
  },
};
