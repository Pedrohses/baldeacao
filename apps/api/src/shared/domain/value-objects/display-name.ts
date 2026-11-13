// Palavras que ficam como vieram quando estão em minúscula ("Rainha-da-Noite", "R. dos Andradas").
const KEEP_LOWERCASE = new Set([
  'a',
  'o',
  'e',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'na',
  'no',
  'nas',
  'nos',
  'del',
  'di',
  'km',
]);

// Começo de palavra: início do texto, espaço, hífen, barra ou parêntese.
const WORD = /(^|[\s\-/(])(\p{L})(\p{L}*)/gu;

/**
 * Corrige a capitalização dos nomes do GTFS da SPTrans sem reescrever o que já está certo:
 * "Portuguesa-tietê" vira "Portuguesa-Tietê", "Term. áGua Espraia" vira "Term. Água Espraia",
 * "(chácara Do Sol)" vira "(Chácara Do Sol)". Abreviações ("Av.", "R.", "Pq."), siglas
 * ("CPTM", "USP") e números ficam como estão.
 */
export function fixDisplayCase(text: string): string {
  return text.replace(WORD, (match, sep: string, first: string, rest: string) => {
    const word = first + rest;
    const upper = first.toLocaleUpperCase('pt-BR');
    const isLower = first !== upper;
    if (!isLower) return match;
    // "áGua": a maiúscula escorregou para a segunda letra.
    if (/^\p{Lu}/u.test(rest)) {
      return `${sep}${upper}${rest.toLocaleLowerCase('pt-BR')}`;
    }
    if (KEEP_LOWERCASE.has(word)) return match;
    return `${sep}${upper}${rest}`;
  });
}
