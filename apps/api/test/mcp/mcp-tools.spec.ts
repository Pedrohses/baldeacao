import type { INestApplication } from '@nestjs/common';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { VehiclePosition } from '@baldeacao/types';
import { Arrival } from '../../src/modules/transit/domain/entities/arrival.entity';
import { OlhoVivoAuthError } from '../../src/shared/domain/errors/olho-vivo-auth.error';
import { SourceUnavailableError } from '../../src/shared/domain/errors/source-unavailable.error';
import { connectClient, type McpFakes, startMcpApp } from './mcp-test-app';

function textOf(result: CallToolResult): string {
  return result.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<CallToolResult> {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

function arrival(routeShortName: string, minutes: number, vehicleId: string | null): Arrival {
  return new Arrival({
    stopId: '4301848',
    routeId: routeShortName,
    routeShortName,
    directionId: 0,
    headsign: 'Aeroporto',
    vehicleId,
    expectedAt: new Date(Date.now() + minutes * 60_000).toISOString(),
    isRealtime: vehicleId !== null,
    accessible: true,
    vehicleLocation: null,
  });
}

function vehicle(vehicleId: string, routeId: string): VehiclePosition {
  return {
    vehicleId,
    sourceId: 'sptrans',
    routeId,
    routeShortName: routeId,
    directionId: 1,
    location: { lat: -23.5455, lon: -46.6685 },
    accessible: true,
    recordedAt: new Date(Date.now() - 20_000).toISOString(),
  };
}

describe('Tools MCP (cliente do SDK contra a app de teste)', () => {
  let app: INestApplication;
  let client: Client;
  let fakes: McpFakes;

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
    fakes.arrivals.byStop.clear();
    fakes.positions.data.clear();
    fakes.positions.failWith = null;
  });

  describe('buscar_linha', () => {
    it('acha a linha pelo nome e devolve o código', async () => {
      const result = await call(client, 'buscar_linha', { texto: 'Aeroporto' });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('875A-10: Perdizes - Aeroporto (ônibus)');
      expect(result.structuredContent).toEqual({
        cidade: 'São Paulo',
        linhas: [
          {
            codigo: '875A-10',
            numero: '875A-10',
            nome: 'Perdizes - Aeroporto',
            tipo: 'ônibus',
            cor: '509E2F',
          },
        ],
      });
    });

    it('responde em texto quando não acha nada', async () => {
      const result = await call(client, 'buscar_linha', { texto: 'Lua' });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('Não encontrei linha para "Lua"');
    });

    it('rejeita texto curto demais com isError', async () => {
      const result = await call(client, 'buscar_linha', { texto: 'a' });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('pelo menos 2 caracteres');
    });

    it('recusa cidade que ainda não é atendida', async () => {
      const result = await call(client, 'buscar_linha', {
        texto: '875A',
        cidade: 'Rio de Janeiro',
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe(
        'Ainda não tenho dados de Rio de Janeiro. Por enquanto só atendo São Paulo.',
      );
    });

    it('aceita São Paulo escrito de várias formas', async () => {
      for (const cidade of ['São Paulo', 'sao paulo', 'SP']) {
        const result = await call(client, 'buscar_linha', { texto: '875A', cidade });
        expect(result.isError).toBeFalsy();
      }
    });
  });

  describe('paradas_proximas', () => {
    it('lista as paradas no raio, da mais perto à mais longe', async () => {
      const result = await call(client, 'paradas_proximas', {
        latitude: -23.56,
        longitude: -46.65,
        raio_metros: 2000,
      });
      expect(result.isError).toBeFalsy();
      const { paradas } = result.structuredContent as { paradas: Array<{ codigo: string }> };
      expect(paradas.map((p) => p.codigo)).toEqual(['4301848', '4200961']);
      expect(textOf(result)).toMatch(
        /- 4301848: Av\. Paulista 1578 \(Em frente ao MASP\), a \d+ m/,
      );
    });

    it('avisa quando não há paradas no raio', async () => {
      const result = await call(client, 'paradas_proximas', {
        latitude: -23.4,
        longitude: -46.4,
      });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('Não encontrei paradas a até 500 m');
    });

    it('rejeita coordenada fora do intervalo', async () => {
      const result = await call(client, 'paradas_proximas', { latitude: 123, longitude: 0 });
      expect(result.isError).toBe(true);
    });
  });

  describe('previsao_chegada', () => {
    it('lista as próximas chegadas e filtra pelo número da linha', async () => {
      fakes.arrivals.byStop.set('4301848', [
        arrival('8000-10', 2, '22222'),
        arrival('875A-10', 5, '11111'),
        arrival('875A-10', 0, null),
      ]);

      const all = await call(client, 'previsao_chegada', { parada: '4301848' });
      expect(all.isError).toBeFalsy();
      expect(textOf(all)).toContain('Próximos ônibus na parada 4301848:');
      expect(textOf(all)).toContain(
        '- 875A-10 para Aeroporto: chegando agora, pela tabela, acessível',
      );

      const only875 = await call(client, 'previsao_chegada', { parada: '4301848', linha: '875a' });
      const { chegadas } = only875.structuredContent as {
        chegadas: Array<{ linha: string; minutos: number; veiculo: string | null }>;
      };
      expect(chegadas.map((c) => [c.linha, c.minutos, c.veiculo])).toEqual([
        ['875A-10', 0, null],
        ['875A-10', 5, '11111'],
      ]);
      expect(textOf(only875)).toMatch(
        /875A-10 para Aeroporto: em 5 min \(\d{2}:\d{2}\), tempo real, veículo 11111/,
      );
    });

    it('responde em texto quando não há previsão', async () => {
      const result = await call(client, 'previsao_chegada', { parada: '4200961', linha: '875A' });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toBe(
        'Não há previsão de ônibus da linha 875A na parada 4200961 agora.',
      );
    });

    it('fonte fora do ar vira mensagem amigável com isError', async () => {
      fakes.arrivals.byStop.set('4301848', new SourceUnavailableError('olho-vivo'));
      const result = await call(client, 'previsao_chegada', { parada: '4301848' });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('está indisponível no momento');
    });

    it('token recusado não vaza o nome da configuração', async () => {
      fakes.arrivals.byStop.set('4301848', new OlhoVivoAuthError());
      const result = await call(client, 'previsao_chegada', { parada: '4301848' });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('Olho Vivo');
      expect(textOf(result)).not.toContain('OLHOVIVO_TOKEN');
    });

    it('erro inesperado vira mensagem genérica, sem detalhe interno', async () => {
      fakes.arrivals.byStop.set('4301848', new Error('ECONNRESET 10.0.0.3:6379'));
      const result = await call(client, 'previsao_chegada', { parada: '4301848' });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('falha interna');
      expect(textOf(result)).not.toContain('ECONNRESET');
    });
  });

  describe('onibus_da_linha', () => {
    it('mostra a posição dos ônibus da linha', async () => {
      const now = new Date().toISOString();
      await fakes.positions.replace(
        'sptrans',
        [vehicle('11111', '875A-10'), vehicle('22222', '875A-10'), vehicle('33333', '8000-10')],
        now,
      );
      const result = await call(client, 'onibus_da_linha', { linha: '875A-10' });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('2 ônibus da linha 875A-10 agora');
      expect(textOf(result)).toContain('- veículo 11111, sentido volta: -23.54550, -46.66850');
      expect(result.structuredContent).toMatchObject({
        linha: '875A-10',
        atualizado_em: now,
        dados_atrasados: false,
        total: 2,
      });
    });

    it('sugere o código completo quando a linha veio só com o número', async () => {
      await fakes.positions.replace(
        'sptrans',
        [vehicle('11111', '875A-10')],
        new Date().toISOString(),
      );
      const result = await call(client, 'onibus_da_linha', { linha: '875A' });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('Nenhum ônibus da linha 875A com posição agora');
      expect(textOf(result)).toContain('buscar_linha');
    });

    it('avisa com isError quando ainda não há tempo real', async () => {
      const result = await call(client, 'onibus_da_linha', { linha: '875A-10' });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('Ainda não há posições em tempo real');
    });
  });

  describe('status_dados', () => {
    it('diz que está atualizado quando o último dado é recente', async () => {
      await fakes.positions.replace(
        'sptrans',
        [vehicle('11111', '875A-10')],
        new Date(Date.now() - 10_000).toISOString(),
      );
      const result = await call(client, 'status_dados');
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toMatch(
        /estão atualizados: último dado às \d{2}:\d{2}:\d{2} \(há 10 s\), 1 ônibus/,
      );
      expect(result.structuredContent).toMatchObject({
        situacao: 'atualizado',
        idade_segundos: 10,
        limite_atraso_segundos: 90,
        onibus_com_posicao: 1,
      });
    });

    it('diz que está atrasado depois do limite', async () => {
      await fakes.positions.replace('sptrans', [], new Date(Date.now() - 5 * 60_000).toISOString());
      const result = await call(client, 'status_dados', { cidade: 'São Paulo' });
      expect(textOf(result)).toContain('estão atrasados');
      expect(textOf(result)).toContain('(há 5 min)');
      expect(result.structuredContent).toMatchObject({ situacao: 'atrasado' });
    });

    it('diz que não há dados quando o worker nunca gravou', async () => {
      const result = await call(client, 'status_dados');
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        situacao: 'sem_dados',
        atualizado_em: null,
      });
    });

    it('Redis fora do ar vira isError amigável', async () => {
      fakes.positions.failWith = new Error('connect ECONNREFUSED 127.0.0.1:6379');
      const result = await call(client, 'status_dados');
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('Não consegui consultar os dados agora');
    });
  });
});
