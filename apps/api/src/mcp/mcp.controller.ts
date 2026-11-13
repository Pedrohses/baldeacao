import type { IncomingMessage, ServerResponse } from 'node:http';
import { Controller, Delete, Get, Logger, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServerFactory } from './mcp-server.factory';

export const MCP_PATH = 'mcp';

type JsonBodyRequest = IncomingMessage & { body?: unknown };

/**
 * Streamable HTTP em modo stateless: sem Mcp-Session-Id, um servidor e um transporte por POST.
 * As tools são só de leitura e não mandam notificação ao cliente, então não há o que guardar
 * entre requisições, e a API escala horizontalmente sem sessão fixa. GET (stream SSE do
 * servidor) e DELETE (encerrar sessão) só fazem sentido com sessão: respondem 405.
 */
@Controller(MCP_PATH)
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private readonly servers: McpServerFactory) {}

  @Post()
  async handle(@Req() req: JsonBodyRequest, @Res() res: ServerResponse): Promise<void> {
    const server = this.servers.create();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      // Respostas curtas: JSON direto em vez de abrir um stream SSE por chamada.
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      this.logger.error(`Falha ao atender requisição MCP: ${describe(error)}`);
      if (!res.headersSent) writeJsonRpcError(res, 500, -32603, 'Erro interno do servidor MCP.');
    }
  }

  @Get()
  getNotAllowed(@Res() res: ServerResponse): void {
    methodNotAllowed(res);
  }

  @Delete()
  deleteNotAllowed(@Res() res: ServerResponse): void {
    methodNotAllowed(res);
  }
}

function methodNotAllowed(res: ServerResponse): void {
  res.setHeader('Allow', 'POST');
  writeJsonRpcError(res, 405, -32000, 'Servidor MCP stateless: use POST.');
}

function writeJsonRpcError(
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
