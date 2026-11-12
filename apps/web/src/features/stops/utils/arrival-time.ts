/** Minutos inteiros até a chegada, arredondando para baixo; nunca negativo. */
export function minutesUntil(expectedAt: string, now: Date): number {
  const diffMs = new Date(expectedAt).getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / 60_000));
}

export function formatMinutes(minutes: number): string {
  return minutes < 1 ? 'Agora' : `${minutes} min`;
}
