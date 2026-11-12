import { legHeadsign } from './leg-headsign';

describe('legHeadsign', () => {
  it('headsign igual ao ponto de embarque vira o outro terminal da linha', () => {
    expect(legHeadsign('Metrô São Judas', 'São Judas', 'Jd. Clímax - Metrô São Judas')).toBe(
      'Jd. Clímax',
    );
    expect(legHeadsign('Metrô São Judas', 'Metrô São Judas', 'Vl. Liviero - Metrô São Judas')).toBe(
      'Vl. Liviero',
    );
    // Linha com quatro partes: sobra o outro par.
    expect(
      legHeadsign(
        'CORINTHIANS - ITAQUERA',
        'Corinthians-Itaquera',
        'CORINTHIANS - ITAQUERA - PALMEIRAS - BARRA FUNDA',
      ),
    ).toBe('PALMEIRAS - BARRA FUNDA');
  });

  it('mantém o headsign quando não é o ponto de embarque ou não há como corrigir', () => {
    expect(
      legHeadsign('Metrô São Judas', 'Av. Jabaquara, 1300', 'Jd. Clímax - Metrô São Judas'),
    ).toBe('Metrô São Judas');
    expect(legHeadsign('Metrô São Judas', 'São Judas', null)).toBe('Metrô São Judas');
    expect(legHeadsign('Metrô São Judas', 'São Judas', 'Circular São Judas')).toBe(
      'Metrô São Judas',
    );
    expect(legHeadsign(null, 'São Judas', 'A - B')).toBeNull();
    // "Sé" curto demais para casar por trecho com "Praça da Sé Norte".
    expect(legHeadsign('Sé', 'Praça da Sé Norte', 'Sé - Lapa')).toBe('Sé');
  });
});
