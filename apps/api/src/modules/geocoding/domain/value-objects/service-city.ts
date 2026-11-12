import type { Coordinates } from '../entities/place.entity';

/**
 * Município atendido (por enquanto só a capital paulista). A busca de lugar penaliza o que
 * fica fora dele e pondera pela distância ao marco zero.
 */
export const SERVICE_CITY_NAME = 'São Paulo';

/** Nível administrativo do município no OSM brasileiro (admin_level=8). */
export const SERVICE_CITY_ADMIN_LEVEL = '8';

/** Marco zero da cidade (Praça da Sé). */
export const SERVICE_CITY_CENTER: Coordinates = { lat: -23.5503, lon: -46.6339 };

/**
 * Apelidos de bairro que o OSM não tem: na capital não existe bairro "Centro", e quem busca
 * "Centro" quer o centro histórico (distrito da Sé). Aplicado aos bairros (place=*) na
 * importação.
 */
export const SERVICE_CITY_NEIGHBOURHOOD_ALIASES: Readonly<Record<string, readonly string[]>> = {
  Sé: ['Centro', 'Centro Histórico'],
};

/** Distância em metros entre dois pontos (haversine). */
export function distanceM(a: Coordinates, b: Coordinates): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h));
}
