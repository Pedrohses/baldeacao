import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Contrato de uma tool MCP. Cada contexto implementa as suas em
 * `modules/<contexto>/presentation/mcp/*.tool.ts` e as lista no `mcp-tools.ts` do contexto.
 * A tool valida a entrada (Zod), chama um caso de uso e formata a saída; nada de regra de negócio.
 */
export abstract class McpTool {
  /** Nome da tool no protocolo, em snake_case e em português (ex.: "buscar_linha"). */
  abstract readonly name: string;

  /** Registra a tool no servidor com `server.registerTool(this.name, ...)`. */
  abstract register(server: McpServer): void;
}
