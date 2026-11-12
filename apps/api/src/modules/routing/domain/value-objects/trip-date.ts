// Datas do pedido de viagem: hora pedida no passado e data local para a validade do GTFS.

/** Hora pedida que já passou há mais que isso vai para o dia seguinte (com aviso). */
export const PAST_TIME_TOLERANCE_MS = 5 * 60_000;

/** Fuso da rede atendida (datas do calendar.txt são locais). */
export const SERVICE_TIME_ZONE = 'America/Sao_Paulo';

const DAY_MS = 24 * 60 * 60_000;
// AAAA-MM-DD, resto da hora e fuso: "2026-11-12", "T08:00:00", "-03:00".
const ISO_PARTS = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:\d{2})$/;

function addDays(year: number, month: number, day: number, days: number): string {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Se `iso` já passou (mais de 5 min antes de `now`), o mesmo horário local no próximo dia que
 * ainda não passou, com o mesmo fuso; senão null. Ex.: 08:00 de ontem com agora 16:00 vira
 * 08:00 de amanhã.
 */
export function movePastTimeForward(iso: string, now: Date): string | null {
  const at = Date.parse(iso);
  const limit = now.getTime() - PAST_TIME_TOLERANCE_MS;
  if (Number.isNaN(at) || at >= limit) return null;
  const match = ISO_PARTS.exec(iso);
  if (!match) return null;
  const [, y, m, d, time, zone] = match;
  const days = Math.max(1, Math.ceil((limit - at) / DAY_MS));
  return `${addDays(Number(y), Number(m), Number(d), days)}${time}${zone}`;
}

/** Data local (AAAA-MM-DD) do pedido: a escrita no ISO (já no fuso dele) ou hoje na cidade. */
export function serviceDateOf(iso: string | null, now: Date): string {
  if (iso) return iso.slice(0, 10);
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SERVICE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
