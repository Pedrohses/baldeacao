import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** Sobe a app de teste numa porta efêmera e devolve a URL do /mcp. */
export async function startMcpApp(
  builder: TestingModuleBuilder,
): Promise<{ app: INestApplication; url: URL }> {
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  const address = server.address() as AddressInfo;
  return { app, url: new URL(`http://127.0.0.1:${address.port}/mcp`) };
}

/** Cliente MCP oficial do SDK conectado por Streamable HTTP. */
export async function connectClient(url: URL): Promise<Client> {
  const client = new Client({ name: 'baldeacao-teste', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(url));
  return client;
}

/** POST JSON-RPC cru, para testar o que o cliente do SDK esconde (status HTTP, cabeçalhos). */
export function rawPost(url: URL, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
