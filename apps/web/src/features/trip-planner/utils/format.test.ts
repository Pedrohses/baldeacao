import { describe, expect, it } from 'vitest';

import {
  formatDistance,
  formatDuration,
  formatTime,
  formatTransfers,
  legColor,
  readableTextColor,
} from './format';

describe('formatação do itinerário', () => {
  it('formata duração em minutos e horas', () => {
    expect(formatDuration(20)).toBe('1 min');
    expect(formatDuration(1080)).toBe('18 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3840)).toBe('1 h 4 min');
  });

  it('mostra o horário no fuso de São Paulo', () => {
    expect(formatTime('2026-11-12T08:00:00-03:00')).toBe('08:00');
    expect(formatTime('2026-11-12T12:04:00Z')).toBe('09:04');
  });

  it('formata distância e baldeações', () => {
    expect(formatDistance(650)).toBe('650 m');
    expect(formatDistance(14500)).toBe('14,5 km');
    expect(formatTransfers(0)).toBe('Sem baldeação');
    expect(formatTransfers(1)).toBe('1 baldeação');
    expect(formatTransfers(2)).toBe('2 baldeações');
  });

  it('resolve a cor do trecho e um texto legível sobre ela', () => {
    expect(legColor({ mode: 'walk', routeColor: null })).toBe('#525252');
    expect(legColor({ mode: 'bus', routeColor: '509e2f' })).toBe('#509E2F');
    expect(legColor({ mode: 'bus', routeColor: null })).toBe('#1D4ED8');
    expect(readableTextColor('#FFD700')).toBe('#000000');
    expect(readableTextColor('#1D4ED8')).toBe('#FFFFFF');
  });
});
