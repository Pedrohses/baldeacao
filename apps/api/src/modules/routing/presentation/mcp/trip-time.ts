// Conversão da hora informada na tool para o ISO 8601 com fuso que o PlanTripUseCase pede.

const CLOCK = /^([01]?\d|2[0-3])(?:[:h]([0-5]\d)|h)$/i;
/** Uma hora que já passou há mais que isso vale para o dia seguinte. */
const PAST_TOLERANCE_MS = 30 * 60_000;

/**
 * "08:00", "8h30" ou "8h" viram hoje (ou amanhã, se já passou) no fuso da cidade.
 * Qualquer outro texto segue como está e o caso de uso valida o ISO 8601.
 */
export function toTripDateTime(value: string, timeZone: string, now: Date = new Date()): string {
  const match = CLOCK.exec(value.trim());
  if (!match) return value.trim();
  const hh = (match[1] ?? '0').padStart(2, '0');
  const mm = match[2] ?? '00';

  const build = (day: Date): string =>
    `${localDate(day, timeZone)}T${hh}:${mm}:00${offset(day, timeZone)}`;
  const today = build(now);
  if (Date.parse(today) >= now.getTime() - PAST_TOLERANCE_MS) return today;
  return build(new Date(now.getTime() + 24 * 60 * 60_000));
}

function localDate(day: Date, timeZone: string): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(day);
}

function offset(day: Date, timeZone: string): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(day)
    .find((p) => p.type === 'timeZoneName')?.value;
  // "GMT-03:00"; "GMT" sozinho é UTC.
  const raw = name?.replace('GMT', '') ?? '';
  return raw === '' ? '+00:00' : raw;
}
