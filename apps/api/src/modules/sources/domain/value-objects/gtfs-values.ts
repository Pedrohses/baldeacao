// Conversões dos campos texto do GTFS. Devolvem undefined quando o valor é inválido;
// quem chama decide se isso é erro (campo obrigatório) ou null (campo opcional).

const TIME = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/;
const DATE = /^(\d{4})(\d{2})(\d{2})$/;
const HEX_COLOR = /^[0-9A-Fa-f]{6}$/;

/** "25:10:00" vira 90600: o GTFS conta a partir da meia-noite do dia de serviço e passa de 24h. */
export function parseGtfsTime(value: string): number | undefined {
  const match = TIME.exec(value.trim());
  if (!match) return undefined;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** 90600 vira "25:10:00": inverso de parseGtfsTime. */
export function formatGtfsTime(seconds: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "20260101" vira "2026-01-01". */
export function parseGtfsDate(value: string): string | undefined {
  const match = DATE.exec(value.trim());
  if (!match) return undefined;
  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${y}-${m}-${d}`;
}

/** Cor hex sem "#", ou null quando ausente ou malformada. */
export function parseGtfsColor(value: string | undefined): string | null {
  const clean = value?.trim().replace(/^#/, '') ?? '';
  return HEX_COLOR.test(clean) ? clean.toUpperCase() : null;
}

export function parseGtfsDirection(value: string | undefined): 0 | 1 | null {
  const clean = value?.trim();
  if (clean === '0') return 0;
  if (clean === '1') return 1;
  return null;
}

export function parseGtfsBoolean(value: string | undefined): boolean | undefined {
  const clean = value?.trim();
  if (clean === '1') return true;
  if (clean === '0') return false;
  return undefined;
}
