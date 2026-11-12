import { Inject, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpTool } from './mcp-tool';
import { MCP_TOOLS } from './mcp-tools';

export const MCP_SERVER_NAME = 'baldeacao';
export const MCP_SERVER_VERSION = '0.1.0';

const INSTRUCTIONS =
  'Baldeação: transporte público de São Paulo (SPTrans) em tempo real, somente leitura. ' +
  'Use buscar_linha para achar o código de uma linha, paradas_proximas para achar o código de uma parada, ' +
  'previsao_chegada para saber quando o ônibus passa, onibus_da_linha para ver onde estão os ônibus ' +
  'e status_dados para conferir se o tempo real está atualizado.';

/**
 * Monta um McpServer novo com todas as tools. No modo stateless cada requisição HTTP
 * ganha o seu servidor e transporte, porque um McpServer só se conecta a um transporte.
 */
@Injectable()
export class McpServerFactory {
  constructor(@Inject(MCP_TOOLS) private readonly tools: McpTool[]) {}

  create(): McpServer {
    const server = new McpServer(
      { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      { instructions: INSTRUCTIONS },
    );
    for (const tool of this.tools) tool.register(server);
    return server;
  }
}
