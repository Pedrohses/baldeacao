import { normalizeAddressQuery, postalCodeOnly, streetOnlyQuery } from './nominatim-query';

describe('normalizeAddressQuery', () => {
  it('converte o formato do Google para vírgulas, sem CEP nem UF', () => {
    expect(
      normalizeAddressQuery(
        'Av. Miguel Estefno, 3031 - Vila Água Funda, São Paulo - SP, 04301-905',
      ),
    ).toBe('Av. Miguel Estefno, 3031, Vila Água Funda, São Paulo');
  });

  it('mantém consultas simples', () => {
    expect(normalizeAddressQuery('Rua Augusta 1500')).toBe('Rua Augusta 1500');
    expect(normalizeAddressQuery('Jardim Botânico')).toBe('Jardim Botânico');
  });
});

describe('streetOnlyQuery', () => {
  it('reduz para rua, número e cidade', () => {
    expect(streetOnlyQuery('Av. Miguel Estefno, 3031, Vila Água Funda, São Paulo')).toBe(
      'Av. Miguel Estefno, 3031, São Paulo',
    );
  });

  it('não reduz consultas curtas', () => {
    expect(streetOnlyQuery('Rua Augusta, 1500')).toBeNull();
  });
});

describe('postalCodeOnly', () => {
  it('reconhece só CEP, com ou sem hífen e prefixo', () => {
    expect(postalCodeOnly('01310-200')).toBe('01310-200');
    expect(postalCodeOnly(' 01310200 ')).toBe('01310-200');
    expect(postalCodeOnly('cep:01310-200')).toBe('01310-200');
    expect(postalCodeOnly('Av. Paulista, 1578, 01310-200')).toBeNull();
  });
});
