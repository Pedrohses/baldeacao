/**
 * Ponto de acesso de um lugar para o planejamento de viagem. O centroide de um lugar grande
 * (aeroporto, parque, terminal) pode ficar longe de qualquer entrada ou do lado errado de uma
 * passarela; a rota sai ou chega pela parada ou estação que serve o lugar.
 *
 * - `airport`: estação de metrô/trem mais próxima a até 3 km quando não há parada a pé (1 km);
 *   o trecho até os terminais é o ônibus gratuito do aeroporto (aviso airport_shuttle).
 * - `station`: a parada GTFS da própria estação (a até 400 m do ponto do OSM).
 * - `terminal`: terminal rodoviário ou de ônibus; estação ao lado primeiro, senão a parada mais
 *   próxima, a até 400 m (o OSM nem sempre liga a passarela do terminal ao metrô).
 * - `compact`: shopping, estádio, hospital; parada mais próxima a até 400 m.
 * - `large`: parque, campus, zoológico, cemitério; parada mais próxima a até 1,5 km quando o
 *   centroide fica a mais de 250 m de qualquer parada.
 */
export type PlaceAccessRule = 'airport' | 'station' | 'terminal' | 'compact' | 'large';

export const AIRPORT_ACCESS_RADIUS_M = 3000;
/** Aeroporto com parada a até isto do centroide é acessível a pé (ex.: Congonhas). */
export const AIRPORT_WALKABLE_STOP_M = 1000;
export const COMPACT_ACCESS_RADIUS_M = 400;
export const LARGE_ACCESS_RADIUS_M = 1500;
/** Parada a menos disso do centroide: o lugar grande já é acessível e fica como está. */
export const LARGE_ACCESS_MIN_OFFSET_M = 250;
/** Raio para reconhecer que um ponto é um lugar conhecido (o centroide que a busca devolveu). */
export const PLACE_LOOKUP_RADIUS_M = 50;
/** Ponto a até isto de uma parada é a própria parada (escolhida na busca ou no mapa). */
export const STOP_LOOKUP_RADIUS_M = 5;

const RULE_BY_CATEGORY: Readonly<Record<string, PlaceAccessRule>> = {
  'aeroway=aerodrome': 'airport',
  'railway=station': 'station',
  'amenity=bus_station': 'terminal',
  'shop=mall': 'compact',
  'leisure=stadium': 'compact',
  'amenity=hospital': 'compact',
  'leisure=park': 'large',
  'leisure=garden': 'large',
  'tourism=zoo': 'large',
  'amenity=university': 'large',
  'amenity=college': 'large',
  'landuse=cemetery': 'large',
};

export function foldPlaceName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Regra de acesso pela categoria OSM e pelo nome ("Aeroporto ...", "Terminal ..."), ou null
 * quando o ponto do lugar já serve (endereço, museu, teatro...).
 */
export function placeAccessRule(place: { category: string; name: string }): PlaceAccessRule | null {
  const byCategory = RULE_BY_CATEGORY[place.category];
  if (byCategory === 'airport' || byCategory === 'station') return byCategory;
  const name = foldPlaceName(place.name);
  // "Jardim Aeroporto" (bairro) não é aeroporto; "Aeroporto Internacional ..." (bairro) é.
  if (name.startsWith('aeroporto ')) return 'airport';
  if (name.startsWith('terminal ')) return 'terminal';
  return byCategory ?? null;
}

/** Estação que atende um aeroporto (ex.: "Aeroporto Guarulhos", da CPTM). */
export function isAirportStationName(name: string): boolean {
  return foldPlaceName(name).includes('aeroporto');
}
