/** Item de `/search?format=jsonv2&addressdetails=1` do Nominatim (só os campos usados). */
export interface NominatimSearchResult {
  place_id: number;
  /** "node", "way" ou "relation". */
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  category: string;
  type: string;
  addresstype?: string;
  name?: string | null;
  display_name: string;
  address?: Record<string, string | undefined>;
}
