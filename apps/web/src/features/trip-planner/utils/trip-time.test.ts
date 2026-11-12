import { describe, expect, it } from 'vitest';

import { effectiveTripTime, nextSlot, tripTimeFields, tripTimeLabel } from './trip-time';

// 23:58 do dia 12 em São Paulo.
const LATE = new Date('2026-11-13T02:58:00Z');
const MORNING = new Date('2026-11-12T11:02:00Z'); // 08:02 em São Paulo

describe('hora da viagem', () => {
  it('sem hora escolhida, parte agora (sem campos de hora)', () => {
    expect(tripTimeFields({ kind: 'now' }, MORNING)).toEqual({});
    expect(tripTimeLabel({ kind: 'now' }, MORNING)).toBe('Sair agora');
  });

  it('monta departAt e arriveBy no fuso de São Paulo, hoje ou amanhã', () => {
    expect(tripTimeFields({ kind: 'depart', day: 'today', hour: 8, minute: 30 }, MORNING)).toEqual({
      departAt: '2026-11-12T08:30:00-03:00',
    });
    // Às 23:58, "amanhã" é o dia 13 mesmo com o UTC já no dia 13.
    expect(tripTimeFields({ kind: 'arrive', day: 'tomorrow', hour: 7, minute: 5 }, LATE)).toEqual({
      arriveBy: '2026-11-13T07:05:00-03:00',
    });
  });

  it('formata o chip e abre o seletor no próximo passo de 5 min', () => {
    expect(tripTimeLabel({ kind: 'depart', day: 'today', hour: 8, minute: 5 }, MORNING)).toBe(
      'Sair às 08:05',
    );
    expect(tripTimeLabel({ kind: 'arrive', day: 'tomorrow', hour: 19, minute: 0 }, MORNING)).toBe(
      'Chegar até 19:00 amanhã',
    );
    expect(nextSlot(MORNING)).toEqual({ day: 'today', hour: 8, minute: 5 });
    expect(nextSlot(LATE)).toEqual({ day: 'tomorrow', hour: 0, minute: 0 });
  });

  it('horário de hoje que já passou vai para amanhã, no pedido e no chip', () => {
    const past = { kind: 'depart', day: 'today', hour: 7, minute: 0 } as const;
    expect(effectiveTripTime(past, MORNING)).toEqual({ ...past, day: 'tomorrow' });
    expect(tripTimeFields(past, MORNING)).toEqual({ departAt: '2026-11-13T07:00:00-03:00' });
    expect(tripTimeLabel(past, MORNING)).toBe('Sair às 07:00 amanhã');
    expect(tripTimeLabel({ kind: 'arrive', day: 'today', hour: 8, minute: 0 }, MORNING)).toBe(
      'Chegar até 08:00 amanhã',
    );
    // O minuto atual ainda vale hoje.
    expect(tripTimeLabel({ kind: 'depart', day: 'today', hour: 8, minute: 2 }, MORNING)).toBe(
      'Sair às 08:02',
    );
  });
});
