import { describe, expect, it } from 'vitest';

import {
  formatDeparture,
  formatDistance,
  formatDuration,
  formatTime,
  formatTransfers,
  legColor,
  placeLabel,
  readableTextColor,
  shortRouteName,
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
    expect(legColor({ mode: 'walk', routeColor: null })).toBe('#6F574A');
    expect(legColor({ mode: 'bus', routeColor: '509e2f' })).toBe('#509E2F');
    expect(legColor({ mode: 'bus', routeColor: null })).toBe('#C7361F');
    expect(readableTextColor('#FFD700')).toBe('#000000');
    expect(readableTextColor('#C7361F')).toBe('#FFFFFF');
  });

  it('encurta nomes de metrô e trem e troca os nomes genéricos do OTP', () => {
    expect(shortRouteName('METRÔ L4')).toBe('L4');
    expect(shortRouteName('CPTM L9')).toBe('L9');
    expect(shortRouteName('746H-10')).toBe('746H-10');
    expect(shortRouteName(null)).toBeNull();
    expect(placeLabel('Destino')).toBe('o destino');
    expect(placeLabel('Origem')).toBe('a origem');
    expect(placeLabel('Sé')).toBe('Sé');
  });

  it('diz quando sai: agora, em minutos ou o horário', () => {
    const now = new Date('2026-11-12T08:00:00-03:00');
    expect(formatDeparture('2026-11-12T08:01:00-03:00', now)).toEqual({
      text: 'Sai agora',
      tone: 'now',
    });
    expect(formatDeparture('2026-11-12T08:04:00-03:00', now).text).toBe('Sai em 4 min');
    expect(formatDeparture('2026-11-12T10:30:00-03:00', now).text).toBe('Sai às 10:30');
    expect(formatDeparture('2026-11-13T07:00:00-03:00', now).text).toBe('Sai amanhã às 07:00');
    // Minutos negativos não são "Sai agora".
    expect(formatDeparture('2026-11-12T07:50:00-03:00', now)).toEqual({
      text: 'Saiu às 07:50',
      tone: 'past',
    });
  });
});
