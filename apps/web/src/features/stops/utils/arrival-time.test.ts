import { describe, expect, it } from 'vitest';

import { formatMinutes, minutesUntil } from './arrival-time';

const now = new Date('2026-11-12T15:31:00Z');

describe('arrival-time', () => {
  it('calcula minutos até a chegada respeitando o fuso', () => {
    expect(minutesUntil('2026-11-12T12:36:00-03:00', now)).toBe(5);
  });

  it('não devolve valor negativo para previsão no passado', () => {
    expect(minutesUntil('2026-11-12T15:00:00Z', now)).toBe(0);
  });

  it('formata menos de um minuto como "Agora"', () => {
    expect(formatMinutes(0)).toBe('Agora');
    expect(formatMinutes(7)).toBe('7 min');
  });
});
