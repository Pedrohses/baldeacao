import {
  parseGtfsBoolean,
  parseGtfsColor,
  parseGtfsDate,
  parseGtfsDirection,
  parseGtfsTime,
} from './gtfs-values';

describe('valores do GTFS', () => {
  it('converte horas em segundos, inclusive depois das 24h', () => {
    expect(parseGtfsTime('00:00:00')).toBe(0);
    expect(parseGtfsTime('08:30:15')).toBe(30_615);
    expect(parseGtfsTime('25:10:00')).toBe(90_600);
    expect(parseGtfsTime(' 5:00:00 ')).toBe(18_000);
    expect(parseGtfsTime('08:61:00')).toBeUndefined();
    expect(parseGtfsTime('')).toBeUndefined();
  });

  it('converte datas AAAAMMDD', () => {
    expect(parseGtfsDate('20261231')).toBe('2026-12-31');
    expect(parseGtfsDate('20261301')).toBeUndefined();
    expect(parseGtfsDate('2026-12-31')).toBeUndefined();
  });

  it('normaliza cores e descarta as malformadas', () => {
    expect(parseGtfsColor('509e2f')).toBe('509E2F');
    expect(parseGtfsColor('#FFFFFF')).toBe('FFFFFF');
    expect(parseGtfsColor('')).toBeNull();
    expect(parseGtfsColor('red')).toBeNull();
    expect(parseGtfsColor(undefined)).toBeNull();
  });

  it('lê sentido e flags', () => {
    expect(parseGtfsDirection('0')).toBe(0);
    expect(parseGtfsDirection('1')).toBe(1);
    expect(parseGtfsDirection('')).toBeNull();
    expect(parseGtfsBoolean('1')).toBe(true);
    expect(parseGtfsBoolean('0')).toBe(false);
    expect(parseGtfsBoolean('2')).toBeUndefined();
  });
});
