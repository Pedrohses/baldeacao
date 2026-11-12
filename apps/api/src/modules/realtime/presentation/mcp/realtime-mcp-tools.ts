import type { Type } from '@nestjs/common';
import type { McpTool } from '../../../../mcp/mcp-tool';
import { DataStatusTool } from './data-status.tool';
import { LineVehiclesTool } from './line-vehicles.tool';

/** Tools MCP do realtime; dependem só dos casos de uso exportados pelo RealtimeModule. */
export const REALTIME_MCP_TOOLS: Type<McpTool>[] = [LineVehiclesTool, DataStatusTool];
