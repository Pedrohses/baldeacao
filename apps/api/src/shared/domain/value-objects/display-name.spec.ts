import { fixDisplayCase } from './display-name';

describe('fixDisplayCase', () => {
  it.each([
    ['Portuguesa-tietê', 'Portuguesa-Tietê'],
    ['Term. áGua Espraia', 'Term. Água Espraia'],
    ['R. Rainha-da-noite, 12', 'R. Rainha-da-Noite, 12'],
    ['Av. Jacu-pêssego/nova Trabalhadores, 3834', 'Av. Jacu-Pêssego/Nova Trabalhadores, 3834'],
    ['R. Quatro (chácara Do Sol-s Ama)', 'R. Quatro (Chácara Do Sol-S Ama)'],
  ])('%s vira %s', (input, expected) => {
    expect(fixDisplayCase(input)).toBe(expected);
  });

  it.each([
    'Av. Paulista, 1578',
    'Pça. da Sé',
    'METRÔ L1',
    'CPTM L11',
    'Shop. Aricanduva',
    'Pq. Res. Cocaia - Pça. Da Sé',
    'Rod. Anhanguera, km 22',
    'USP Leste',
  ])('%s fica como está', (input) => {
    expect(fixDisplayCase(input)).toBe(input);
  });
});
