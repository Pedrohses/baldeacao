/** Coordenada WGS 84 em graus decimais. */
export interface Coordinates {
  readonly lat: number;
  readonly lon: number;
}

export function isValidCoordinates({ lat, lon }: Coordinates): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}
