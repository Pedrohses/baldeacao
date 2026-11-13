/** Tags de um objeto OSM (chave para valor). */
export type OsmTags = Readonly<Record<string, string | undefined>>;

/**
 * Categorias importadas, com a importância usada no desempate da busca (maior aparece antes).
 * `*` aceita qualquer valor da chave.
 */
const CATEGORIES: ReadonlyArray<{
  key: string;
  values: ReadonlySet<string> | '*';
  importance: number;
}> = [
  { key: 'aeroway', values: new Set(['aerodrome']), importance: 9 },
  { key: 'railway', values: new Set(['station']), importance: 8 },
  { key: 'amenity', values: new Set(['bus_station']), importance: 8 },
  { key: 'leisure', values: new Set(['stadium']), importance: 7 },
  { key: 'leisure', values: new Set(['park']), importance: 7 },
  { key: 'tourism', values: new Set(['zoo']), importance: 7 },
  { key: 'shop', values: new Set(['mall']), importance: 6 },
  { key: 'tourism', values: new Set(['museum']), importance: 6 },
  { key: 'leisure', values: new Set(['garden']), importance: 6 },
  { key: 'amenity', values: new Set(['university', 'hospital']), importance: 6 },
  { key: 'amenity', values: new Set(['theatre', 'marketplace']), importance: 5 },
  { key: 'tourism', values: new Set(['attraction']), importance: 5 },
  { key: 'amenity', values: new Set(['college']), importance: 4 },
  { key: 'landuse', values: new Set(['cemetery']), importance: 4 },
  { key: 'historic', values: '*', importance: 3 },
  // Bairros: "Centro", "Pinheiros", "Tatuapé".
  { key: 'place', values: new Set(['suburb', 'quarter', 'neighbourhood']), importance: 5 },
];

/** Bônus para lugares com verbete no Wikidata (em geral os mais conhecidos). */
const WIKIDATA_BONUS = 2;

export interface OsmPoiCategory {
  /** Tag que classificou, ex.: "leisure=park". */
  category: string;
  importance: number;
  /** Estação de metrô/trem, bairro (endereço) ou ponto de interesse. */
  kind: 'poi' | 'station' | 'address';
}

function kindOf(key: string): OsmPoiCategory['kind'] {
  if (key === 'railway') return 'station';
  if (key === 'place') return 'address';
  return 'poi';
}

// Tags com outros nomes do lugar; valores com ";" são vários nomes.
const ALIAS_KEYS = ['alt_name', 'short_name', 'official_name', 'old_name', 'loc_name'];

/** Nomes alternativos do objeto (ex.: "MASP", "Mercadão", "Allianz Parque"), sem repetir o nome. */
export function osmPoiAliases(tags: OsmTags): string[] {
  const name = tags.name?.trim().toLocaleLowerCase('pt-BR');
  const aliases: string[] = [];
  for (const key of ALIAS_KEYS) {
    for (const raw of tags[key]?.split(';') ?? []) {
      const alias = raw.trim().replace(/\s+/g, ' ');
      const lower = alias.toLocaleLowerCase('pt-BR');
      if (!alias || lower === name || aliases.some((a) => a.toLocaleLowerCase('pt-BR') === lower)) {
        continue;
      }
      aliases.push(alias);
    }
  }
  return aliases;
}

/** Categoria do lugar pelas tags, ou null quando não é uma das importadas. */
export function classifyOsmPoi(tags: OsmTags): OsmPoiCategory | null {
  for (const { key, values, importance } of CATEGORIES) {
    const value = tags[key]?.trim();
    if (!value || value === 'no') continue;
    if (values !== '*' && !values.has(value)) continue;
    const bonus = tags.wikidata?.trim() ? WIKIDATA_BONUS : 0;
    return { category: `${key}=${value}`, importance: importance + bonus, kind: kindOf(key) };
  }
  return null;
}

function tag(tags: OsmTags, key: string): string | null {
  return tags[key]?.trim() || null;
}

/** Endereço curto a partir das tags addr:* ("Rua X, 123, Bairro, Cidade"), ou null. */
export function osmPoiAddress(tags: OsmTags): {
  address: string | null;
  suburb: string | null;
  city: string | null;
} {
  const street = tag(tags, 'addr:street');
  const number = tag(tags, 'addr:housenumber');
  const suburb = tag(tags, 'addr:suburb');
  const city = tag(tags, 'addr:city');
  const parts = [street && number ? `${street}, ${number}` : street, suburb, city].filter(
    (part): part is string => Boolean(part),
  );
  return { address: parts.length > 0 ? parts.join(', ') : null, suburb, city };
}
