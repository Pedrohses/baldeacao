import type { INestApplication } from '@nestjs/common';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  itineraryExample,
  placeDestinationExample,
  placeOriginExample,
} from '@baldeacao/types/examples';
import { Place } from '../../src/modules/geocoding/domain/entities/place.entity';
import { toTripDateTime } from '../../src/modules/routing/presentation/mcp/trip-time';
import { SourceUnavailableError } from '../../src/shared/domain/errors/source-unavailable.error';
import { connectClient, type McpFakes, startMcpApp } from './mcp-test-app';

function textOf(result: CallToolResult): string {
  return result.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');
}

describe('Tool MCP planejar_viagem', () => {
  let app: INestApplication;
  let client: Client;
  let fakes: McpFakes;

  const plan = async (args: Record<string, unknown>) =>
    (await client.callTool({ name: 'planejar_viagem', arguments: args })) as CallToolResult;

  beforeAll(async () => {
    let url: URL;
    ({ app, url, fakes } = await startMcpApp());
    client = await connectClient(url);
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  beforeEach(() => {
    fakes.geocoder.byTerm.clear();
    fakes.geocoder.queries.length = 0;
    fakes.geocodeCache.entries.clear();
    fakes.planner.queries.length = 0;
    fakes.geocoder.byTerm.set('morumbis', [new Place(placeOriginExample)]);
    fakes.geocoder.byTerm.set('tietê', [new Place(placeDestinationExample)]);
    fakes.planner.result = [itineraryExample];
    fakes.stops.outside.clear();
  });

  it('geocodifica origem e destino e descreve o itinerário em português', async () => {
    const result = await plan({
      origem: 'Morumbis',
      destino: 'Terminal Tietê',
      saida: '2026-11-12T08:00:00-03:00',
    });

    expect(result.isError).toBeFalsy();
    expect(fakes.geocoder.queries).toEqual(['morumbis', 'terminal tietê']);
    expect(fakes.planner.queries.filter((q) => !q.excludeModes)).toEqual([
      {
        from: placeOriginExample.location,
        to: placeDestinationExample.location,
        time: { departAt: '2026-11-12T08:00:00-03:00' },
        maxItineraries: 3,
        candidates: 12,
      },
    ]);
    expect(textOf(result)).toBe(
      [
        '1 opção de Estádio do Morumbis para Terminal Rodoviário Tietê:',
        '',
        'Opção 1: 1 h 4 min, saída 08:00, chegada 09:04, 1 baldeação, 650 m a pé.',
        '1. Caminhe 350 m até Av. Giovanni Gronchi (5 min).',
        '2. Pegue o ônibus 7725-10 sentido Rio Pequeno em Av. Giovanni Gronchi às 08:07 e desça em Estação Butantã às 08:25 (18 min, 9 paradas no caminho, horário em tempo real).',
        '3. Pegue o metrô L4 e L1 sentido Tucuruvi em Butantã às 08:31 e desça em Portuguesa-Tietê às 09:01 (30 min, 11 paradas no caminho).',
        '4. Caminhe 300 m até Terminal Rodoviário Tietê (3 min).',
      ].join('\n'),
    );
    expect(result.structuredContent).toMatchObject({
      cidade: 'São Paulo',
      origem: { nome: 'Estádio do Morumbis', latitude: -23.6, longitude: -46.7202 },
      destino: { nome: 'Terminal Rodoviário Tietê' },
      itinerarios: [
        {
          duracao_min: 64,
          baldeacoes: 1,
          caminhada_metros: 650,
          trechos: [
            { modo: 'walk', linha: null, para: 'Av. Giovanni Gronchi', parada_embarque: null },
            {
              modo: 'bus',
              linha: '7725-10',
              sentido: 'Rio Pequeno',
              parada_embarque: '1906488',
              tempo_real: true,
            },
            { modo: 'subway', linha: 'L4 e L1' },
            { modo: 'walk' },
          ],
        },
      ],
    });
  });

  it('cita as saídas seguintes com as mesmas linhas ("também às")', async () => {
    fakes.planner.result = [
      itineraryExample,
      { ...itineraryExample, startAt: '2026-11-12T08:10:00-03:00' },
      { ...itineraryExample, startAt: '2026-11-12T08:20:00-03:00' },
    ];
    const result = await plan({ origem: 'Morumbis', destino: 'Tietê' });
    expect(textOf(result)).toContain(
      'Opção 1: 1 h 4 min, saída 08:00, chegada 09:04, 1 baldeação, 650 m a pé. ' +
        'Também às 08:10 e 08:20, com as mesmas linhas.',
    );
    expect(result.structuredContent).toMatchObject({
      avisos: [],
      itinerarios: [{ tambem_as: ['2026-11-12T08:10:00-03:00', '2026-11-12T08:20:00-03:00'] }],
    });
  });

  it('explica em português quando origem ou destino ficam longe de qualquer parada', async () => {
    const { lat, lon } = placeDestinationExample.location;
    fakes.stops.outside.add(`${lat},${lon}`);
    const result = await plan({ origem: 'Morumbis', destino: 'Tietê' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toMatch(
      /^Atenção: não há parada de ônibus, metrô ou trem a até 1 km do destino \(Terminal Rodoviário Tietê\)\. O lugar pode estar fora da área atendida em São Paulo/,
    );
    expect(textOf(result)).toContain('1 opção de Estádio do Morumbis');
    expect(result.structuredContent).toMatchObject({
      avisos: ['destination_outside_service_area'],
    });

    fakes.planner.result = [];
    const empty = await plan({ origem: 'Morumbis', destino: 'Tietê' });
    expect(textOf(empty)).toContain('Escolha um ponto mais perto de uma linha.');
  });

  it('aceita hora de chegada no formato HH:MM e coordenada como origem', async () => {
    const result = await plan({
      origem: '-23.6, -46.7202',
      destino: 'Tietê',
      chegada: '9h30',
      opcoes: 2,
    });
    expect(result.isError).toBeFalsy();
    expect(fakes.geocoder.queries).toEqual(['tietê']);
    expect(fakes.planner.queries[0]).toMatchObject({
      from: { lat: -23.6, lon: -46.7202 },
      maxItineraries: 2,
      time: {
        arriveBy: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T09:30:00-03:00$/) as unknown,
      },
    });
  });

  it('caminhada curta com tempo longo explica que inclui espera', async () => {
    const [first, ...rest] = itineraryExample.legs;
    fakes.planner.result = [
      { ...itineraryExample, legs: [{ ...first!, distanceM: 29, durationS: 240 }, ...rest] },
    ];
    const result = await plan({ origem: 'Morumbis', destino: 'Terminal Tietê' });
    expect(textOf(result)).toContain(
      '1. Caminhe 30 m até Av. Giovanni Gronchi (4 min, inclui espera).',
    );
    // Tempo coerente com a distância não ganha a explicação.
    expect(textOf(result)).toContain('Caminhe 300 m até Terminal Rodoviário Tietê (3 min).');
  });

  it('pede endereço mais específico quando não acha a origem', async () => {
    const result = await plan({ origem: 'Lugar Nenhum', destino: 'Tietê' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Não encontrei a origem "Lugar Nenhum"');
    expect(textOf(result)).toContain('endereço mais específico');
    expect(fakes.planner.queries).toHaveLength(0);
  });

  it('aceita origem de 2 caracteres ("Sé") e recusa 1 em português', async () => {
    fakes.geocoder.byTerm.set('sé', [new Place(placeOriginExample)]);
    const ok = await plan({ origem: 'Sé', destino: 'Terminal Tietê' });
    expect(textOf(ok)).not.toContain('Entrada inválida');
    const short = await plan({ origem: 'S', destino: 'Terminal Tietê' });
    expect(short.isError).toBe(true);
    expect(textOf(short)).toBe('Entrada inválida: Informe a origem com pelo menos 2 caracteres.');
  });

  it('pede endereço mais específico quando não acha o destino', async () => {
    const result = await plan({ origem: 'Morumbis', destino: 'Xyzw' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Não encontrei o destino "Xyzw"');
  });

  it('responde em texto quando não há itinerário', async () => {
    fakes.planner.result = [];
    const result = await plan({ origem: 'Morumbis', destino: 'Tietê' });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('Não encontrei itinerário de transporte público');
  });

  it('OTP fora do ar vira isError amigável, sem citar configuração', async () => {
    fakes.planner.result = new SourceUnavailableError(
      'otp',
      'O planejador de viagens não está configurado: defina OTP_URL.',
    );
    const result = await plan({ origem: 'Morumbis', destino: 'Tietê' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      'O planejador de viagens está indisponível no momento. Tente novamente em instantes.',
    );
  });

  it('Nominatim fora do ar vira isError amigável', async () => {
    fakes.geocoder.byTerm.set(
      'morumbis',
      new SourceUnavailableError('nominatim', 'configure NOMINATIM_USER_AGENT.'),
    );
    const result = await plan({ origem: 'Morumbis', destino: 'Tietê' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('A busca de endereços está indisponível');
    expect(textOf(result)).not.toContain('NOMINATIM_USER_AGENT');
  });

  it('saída e chegada juntas viram isError do caso de uso', async () => {
    const result = await plan({
      origem: 'Morumbis',
      destino: 'Tietê',
      saida: '08:00',
      chegada: '09:00',
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('Informe só a hora de saída ou só a de chegada.');
  });
});

describe('toTripDateTime', () => {
  const now = new Date('2026-11-12T10:00:00-03:00');

  it('converte HH:MM para hoje no fuso da cidade', () => {
    expect(toTripDateTime('14:15', 'America/Sao_Paulo', now)).toBe('2026-11-12T14:15:00-03:00');
    expect(toTripDateTime('18h', 'America/Sao_Paulo', now)).toBe('2026-11-12T18:00:00-03:00');
  });

  it('usa o dia seguinte quando a hora já passou', () => {
    expect(toTripDateTime('08:00', 'America/Sao_Paulo', now)).toBe('2026-11-13T08:00:00-03:00');
    expect(toTripDateTime('09:45', 'America/Sao_Paulo', now)).toBe('2026-11-12T09:45:00-03:00');
  });

  it('deixa ISO 8601 como está', () => {
    expect(toTripDateTime(' 2026-11-12T08:00:00-03:00 ', 'America/Sao_Paulo', now)).toBe(
      '2026-11-12T08:00:00-03:00',
    );
  });
});
