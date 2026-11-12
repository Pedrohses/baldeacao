import type { INestApplication } from '@nestjs/common';
import { MCP_SERVER_NAME } from '../../src/mcp/mcp-server.factory';
import { clientIp, MCP_THROTTLE } from '../../src/mcp/mcp-throttler.guard';
import { connectClient, rawPost, startMcpApp } from './mcp-test-app';

const PING = { jsonrpc: '2.0', id: 1, method: 'ping' };

describe('Servidor MCP (Streamable HTTP, stateless)', () => {
  let app: INestApplication;
  let url: URL;

  beforeEach(async () => {
    ({ app, url } = await startMcpApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('responde ao initialize do cliente do SDK, sem sessão', async () => {
    const client = await connectClient(url);
    expect(client.getServerVersion()?.name).toBe(MCP_SERVER_NAME);
    expect(client.getInstructions()).toContain('buscar_linha');
    await expect(client.ping()).resolves.toBeDefined();
    await client.close();

    const res = await rawPost(url, PING);
    expect(res.status).toBe(200);
    expect(res.headers.get('mcp-session-id')).toBeNull();
  });

  it('lista as 6 tools com descrição em português e schema de entrada e saída', async () => {
    const client = await connectClient(url);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'buscar_linha',
      'onibus_da_linha',
      'paradas_proximas',
      'planejar_viagem',
      'previsao_chegada',
      'status_dados',
    ]);
    for (const tool of tools) {
      expect(tool.description).toMatch(/[ãçéêôõí]/);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema?.type).toBe('object');
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
    const nearby = tools.find((t) => t.name === 'paradas_proximas');
    expect(nearby?.inputSchema.required).toEqual(['latitude', 'longitude']);
    await client.close();
  });

  it('responde 405 a GET e DELETE', async () => {
    const get = await fetch(url, { headers: { Accept: 'text/event-stream' } });
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    const del = await fetch(url, { method: 'DELETE' });
    expect(del.status).toBe(405);
  });

  it(`limita a ${MCP_THROTTLE.limit} requisições por minuto por IP`, async () => {
    for (let i = 0; i < MCP_THROTTLE.limit; i++) {
      const res = await rawPost(url, PING);
      expect(res.status).toBe(200);
      await res.text();
    }
    const blocked = await rawPost(url, PING);
    expect(blocked.status).toBe(429);

    // Outro IP vindo pelo túnel local (CF-Connecting-IP) tem o seu próprio limite.
    const other = await rawPost(url, PING, { 'CF-Connecting-IP': '203.0.113.7' });
    expect(other.status).toBe(200);
  });
});

describe('clientIp', () => {
  const req = (remoteAddress: string, cf?: string) => ({
    socket: { remoteAddress },
    headers: cf ? { 'cf-connecting-ip': cf } : {},
  });

  it('usa CF-Connecting-IP só quando a conexão vem do loopback (túnel local)', () => {
    expect(clientIp(req('127.0.0.1', '203.0.113.7'))).toBe('203.0.113.7');
    expect(clientIp(req('::1', '203.0.113.7'))).toBe('203.0.113.7');
    expect(clientIp(req('198.51.100.2', '203.0.113.7'))).toBe('198.51.100.2');
    expect(clientIp(req('198.51.100.2'))).toBe('198.51.100.2');
  });
});
