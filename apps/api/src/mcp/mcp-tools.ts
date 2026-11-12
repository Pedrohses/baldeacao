import type { Type } from '@nestjs/common';
import type { McpTool } from './mcp-tool';

/** Token do array com as instâncias de todas as tools registradas. */
export const MCP_TOOLS = Symbol('MCP_TOOLS');

/** Tools de todos os contextos. Um contexto novo entra aqui com a lista do seu `mcp-tools.ts`. */
export const MCP_TOOL_CLASSES: Type<McpTool>[] = [];
