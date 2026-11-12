import type { Type } from '@nestjs/common';
import { ROUTING_MCP_TOOLS } from '../modules/routing/presentation/mcp/routing-mcp-tools';
import { REALTIME_MCP_TOOLS } from '../modules/realtime/presentation/mcp/realtime-mcp-tools';
import { TRANSIT_MCP_TOOLS } from '../modules/transit/presentation/mcp/transit-mcp-tools';
import type { McpTool } from './mcp-tool';

/** Token do array com as instâncias de todas as tools registradas. */
export const MCP_TOOLS = Symbol('MCP_TOOLS');

/** Tools de todos os contextos. Um contexto novo entra aqui com a lista do seu `mcp-tools.ts`. */
export const MCP_TOOL_CLASSES: Type<McpTool>[] = [
  ...TRANSIT_MCP_TOOLS,
  ...REALTIME_MCP_TOOLS,
  ...ROUTING_MCP_TOOLS,
];
