import type { Type } from '@nestjs/common';
import type { McpTool } from '../../../../mcp/mcp-tool';
import { PlanTripTool } from './plan-trip.tool';

/**
 * Tools MCP do routing; usam o PlanTripUseCase do RoutingModule e o SearchPlacesUseCase
 * exportado pelo GeocodingModule.
 */
export const ROUTING_MCP_TOOLS: Type<McpTool>[] = [PlanTripTool];
