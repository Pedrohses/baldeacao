import type { Type } from '@nestjs/common';
import type { McpTool } from '../../../../mcp/mcp-tool';
import { NearbyStopsTool } from './nearby-stops.tool';
import { SearchLinesTool } from './search-lines.tool';
import { StopArrivalsTool } from './stop-arrivals.tool';

/** Tools MCP do transit; dependem só dos casos de uso exportados pelo TransitModule. */
export const TRANSIT_MCP_TOOLS: Type<McpTool>[] = [
  SearchLinesTool,
  NearbyStopsTool,
  StopArrivalsTool,
];
