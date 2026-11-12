// Sentido do trecho: o GTFS da SPTrans às vezes põe no headsign o terminal de onde a viagem
// sai ("sentido Metrô São Judas" embarcando em São Judas). Aí o sentido é o outro terminal.

// Palavras que não distinguem o lugar ("Metrô São Judas" e "São Judas" são o mesmo ponto).
const NOISE = new Set([
  'metro',
  'estacao',
  'est',
  'term',
  'terminal',
  'cptm',
  'parada',
  'de',
  'da',
  'do',
]);

function placeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !NOISE.has(word))
    .join(' ');
}

function samePlace(a: string, b: string): boolean {
  const ka = placeKey(a);
  const kb = placeKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const [shorter, longer] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return shorter.length >= 4 && ` ${longer} `.includes(` ${shorter} `);
}

/**
 * Headsign corrigido: se ele é o próprio ponto de embarque, o outro terminal do nome da linha
 * ("Jd. Clímax - Metrô São Judas" embarcando em São Judas vira "Jd. Clímax"). Sem como
 * corrigir, devolve o headsign como veio.
 */
export function legHeadsign(
  headsign: string | null,
  boardingName: string,
  routeLongName: string | null,
): string | null {
  if (!headsign || !routeLongName || !samePlace(headsign, boardingName)) return headsign;
  const terminals = routeLongName
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (terminals.length < 2) return headsign;
  const others = terminals.filter((terminal) => !samePlace(terminal, headsign));
  if (others.length === 0 || others.length === terminals.length) return headsign;
  return others.join(' - ');
}
