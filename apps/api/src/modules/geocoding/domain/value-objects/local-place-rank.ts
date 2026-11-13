import type { Place } from '../entities/place.entity';
import { mergePlaces } from './place-merge';
import { distanceM, SERVICE_CITY_CENTER } from './service-city';

/**
 * Candidato da busca de lugar, local (parada, estação, lugar conhecido do OSM) ou do Nominatim,
 * com o que a ordenação precisa saber além do Place.
 */
export interface PlaceCandidate {
  place: Place;
  /** Outros nomes do lugar (alt_name, short_name, official_name, old_name, loc_name do OSM). */
  aliases: string[];
  /** Importância da categoria (parada de ônibus 0, estação 8, ver osm-poi-category). */
  importance: number;
  /** Dentro do município atendido; null quando não se sabe (limite não importado). */
  inCity: boolean | null;
  /** Posição na lista do Nominatim (0 = primeiro); null para candidato local. */
  remoteIndex: number | null;
  /** Categoria OSM do lugar conhecido (ex.: "leisure=park"); null para os demais. */
  category?: string | null;
}

// Abreviações comuns em nomes de rua e de parada da SPTrans ("R. Vergueiro", "Av. Paulista").
const ABBREVIATIONS: Record<string, string> = {
  r: 'rua',
  av: 'avenida',
  avda: 'avenida',
  al: 'alameda',
  pca: 'praca',
  pc: 'praca',
  est: 'estrada',
  estr: 'estrada',
  rod: 'rodovia',
  tv: 'travessa',
  trav: 'travessa',
  lgo: 'largo',
  lg: 'largo',
  vd: 'viaduto',
  dr: 'doutor',
  dra: 'doutora',
  prof: 'professor',
  profa: 'professora',
  eng: 'engenheiro',
  gen: 'general',
  cel: 'coronel',
  pres: 'presidente',
  sen: 'senador',
  dep: 'deputado',
  mal: 'marechal',
  brig: 'brigadeiro',
  cap: 'capitao',
  ten: 'tenente',
  sta: 'santa',
  sto: 'santo',
  pq: 'parque',
  jd: 'jardim',
  vl: 'vila',
  term: 'terminal',
  shop: 'shopping',
};

// Palavras que não distinguem um lugar de outro.
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no']);

const CEP = /\b\d{5}-?\d{3}\b/g;
// Número de casa: depois de uma palavra, no fim do texto ou antes de vírgula ou " - ".
const HOUSE_NUMBER = /[\p{L}.]\s*,?\s+(?:n[º°o.]?\s*)?(\d{1,5})[a-z]?\s*(?=$|,|\s-\s)/u;

export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palavras sem acento, com abreviações expandidas e sem artigos e preposições. */
export function placeTokens(text: string): string[] {
  return foldText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => ABBREVIATIONS[word] ?? word)
    .filter((word) => !STOPWORDS.has(word));
}

/** Consulta analisada: termos significativos e o número de casa, quando é um endereço. */
export interface AnalyzedPlaceQuery {
  terms: string[];
  houseNumber: string | null;
}

export function analyzePlaceQuery(query: string): AnalyzedPlaceQuery {
  const withoutCep = foldText(query).replace(CEP, ' ');
  const houseNumber = HOUSE_NUMBER.exec(withoutCep)?.[1] ?? null;
  const tokens = placeTokens(withoutCep);
  if (houseNumber) {
    const index = tokens.lastIndexOf(houseNumber);
    if (index > 0) tokens.splice(index, 1);
  }
  return { terms: tokens, houseNumber: tokens.length > 0 ? houseNumber : null };
}

/** Palavra sem a vogal de gênero e o plural ("rodoviária" e "rodoviário" viram "rodoviari"). */
function stem(word: string): string {
  return word.length >= 5 ? word.replace(/[ao]s?$/, '') : word;
}

/**
 * Termo começa a palavra, tolerando gênero e número ("Rodoviária" casa "Rodoviário") e uma
 * letra a mais no fim ("Morumbis" casa "Morumbi").
 */
function termMatches(term: string, word: string): boolean {
  if (/^\d+$/.test(term)) return word === term;
  if (word.startsWith(term)) return true;
  if (term.length >= 5 && stem(word).startsWith(stem(term))) return true;
  return word.length >= 5 && term.length === word.length + 1 && term.startsWith(word);
}

/** Fração dos termos que começam alguma palavra do nome (1 = todos). */
function matchedFraction(terms: string[], nameTokens: string[]): number {
  if (terms.length === 0) return 0;
  const matched = terms.filter((term) => nameTokens.some((word) => termMatches(term, word)));
  return matched.length / terms.length;
}

/** Todos os termos casam o nome ou um nome alternativo (match forte). */
export function isStrongMatch(candidate: PlaceCandidate, query: AnalyzedPlaceQuery): boolean {
  return [candidate.place.name, ...candidate.aliases].some(
    (name) => matchedFraction(query.terms, placeTokens(name)) === 1,
  );
}

/** Números que aparecem como palavra no nome (ou no começo do endereço, para endereço). */
function placeNumbers(place: Place): string[] {
  const texts = [place.name];
  if (place.kind === 'address' && place.address) {
    texts.push(place.address.split(',').slice(0, 2).join(' '));
  }
  return texts.flatMap((text) => placeTokens(text).filter((word) => /^\d+$/.test(word)));
}

// Pesos da nota. O texto manda: casar todos os termos vale mais que qualquer outro sinal.
export const RANK_WEIGHTS = {
  allTermsInName: 100,
  allTermsInAlias: 90,
  /** Multiplica a fração de termos casados quando nem todos casam (match fraco). */
  partialTerms: 40,
  /** Nome (ou apelido) igual à consulta; não vale para parada de ônibus (nome de rua). */
  exactName: 35,
  namePrefix: 10,
  importance: 2,
  outsideCity: -70,
  /** Por km de distância ao marco zero, até MAX_DISTANCE_KM. */
  perKmFromCenter: -0.6,
  busStop: -15,
  remoteIndex: -2,
  /**
   * POI do Nominatim que não é lugar conhecido local (ponto de táxi, POI sem tipo): as
   * categorias fortes (parque, terminal, estação, shopping) já vêm do banco local.
   */
  weakRemotePoi: -40,
  sameHouseNumber: 60,
  addressWithSameNumber: 10,
  otherHouseNumber: -80,
  addressWithoutNumber: -10,
  notAnAddress: -30,
} as const;
const MAX_DISTANCE_KM = 40;

/**
 * Nota do candidato para a consulta (maior = melhor). Regras:
 * 1. Match forte: todos os termos significativos começam palavras do nome (ou de um nome
 *    alternativo); senão vale só a fração casada (trigrama solto é fraco).
 * 2. Fora do município atendido perde muito; dentro, perde um pouco por km até a Sé.
 * 3. Consulta com número de casa: mesmo número sobe, número diferente (parada "R. X, 356")
 *    cai, endereço do Nominatim sem número fica no meio.
 * 4. Importância da categoria, estação antes de parada de ônibus e a ordem do Nominatim
 *    desempatam; POI do Nominatim sem categoria local (táxi, POI sem tipo) perde.
 */
export function scorePlaceCandidate(candidate: PlaceCandidate, query: AnalyzedPlaceQuery): number {
  const { place } = candidate;
  const w = RANK_WEIGHTS;
  const joined = query.terms.join(' ');
  const nameTokens = placeTokens(place.name);
  const aliasTokens = candidate.aliases.map(placeTokens);

  let score = 0;
  const nameFraction = matchedFraction(query.terms, nameTokens);
  const aliasFraction = Math.max(0, ...aliasTokens.map((t) => matchedFraction(query.terms, t)));
  if (nameFraction === 1) score += w.allTermsInName;
  else if (aliasFraction === 1) score += w.allTermsInAlias;
  else score += w.partialTerms * Math.max(nameFraction, aliasFraction);

  const exact = [nameTokens, ...aliasTokens].some((tokens) => tokens.join(' ') === joined);
  if (joined && exact && place.kind !== 'stop') {
    score += w.exactName;
  } else if (joined && nameTokens.join(' ').startsWith(joined)) {
    score += w.namePrefix;
  }

  score += w.importance * candidate.importance;
  if (place.kind === 'stop') score += w.busStop;
  if (candidate.inCity === false) score += w.outsideCity;
  const km = distanceM(place.location, SERVICE_CITY_CENTER) / 1000;
  score += w.perKmFromCenter * Math.min(km, MAX_DISTANCE_KM);
  if (candidate.remoteIndex !== null) {
    score += w.remoteIndex * candidate.remoteIndex;
    if (place.kind === 'poi' && !candidate.category) score += w.weakRemotePoi;
  }

  if (query.houseNumber) {
    const numbers = placeNumbers(place);
    if (numbers.includes(query.houseNumber)) {
      score += w.sameHouseNumber + (place.kind === 'address' ? w.addressWithSameNumber : 0);
    } else if (numbers.length > 0) {
      score += w.otherHouseNumber;
    } else {
      score += place.kind === 'address' ? w.addressWithoutNumber : w.notAnAddress;
    }
  }
  return score;
}

/** Com tantos resultados fortes na cidade, os de fora do município saem da lista. */
export const IN_CITY_ENOUGH = 3;

/**
 * Fora do município só entra se faltar resultado bom na cidade: some quando há 3 matches
 * fortes dentro dela, ou quando ele mesmo é match fraco e há algum forte dentro.
 */
function withoutFarAway(candidates: PlaceCandidate[], query: AnalyzedPlaceQuery): PlaceCandidate[] {
  const strongInCity = candidates.filter(
    (c) => c.inCity !== false && isStrongMatch(c, query),
  ).length;
  if (strongInCity === 0) return candidates;
  return candidates.filter(
    (c) => c.inCity !== false || (strongInCity < IN_CITY_ENOUGH && isStrongMatch(c, query)),
  );
}

/**
 * Ordena os candidatos (locais e do Nominatim juntos) pela nota e junta sem repetir o mesmo
 * lugar, até `limit`. Empate: nome mais curto, depois ordem alfabética.
 */
export function rankPlaces(query: string, candidates: PlaceCandidate[], limit: number): Place[] {
  const analyzed = analyzePlaceQuery(query);
  const sorted = withoutFarAway(candidates, analyzed)
    .map((candidate) => ({ candidate, score: scorePlaceCandidate(candidate, analyzed) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.place.name.length - b.candidate.place.name.length ||
        a.candidate.place.name.localeCompare(b.candidate.place.name, 'pt-BR'),
    )
    .map(({ candidate }) => candidate.place);
  return mergePlaces(sorted, [], limit);
}
