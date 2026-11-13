import { Module } from '@nestjs/common';
import { GeocodingModule } from '../modules/geocoding/geocoding.module';
import { RealtimeModule } from '../modules/realtime/realtime.module';
import { RoutingModule } from '../modules/routing/routing.module';
import { TransitModule } from '../modules/transit/transit.module';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import type { McpTool } from './mcp-tool';
import { MCP_TOOL_CLASSES, MCP_TOOLS } from './mcp-tools';

/**
 * Servidor MCP (Streamable HTTP, stateless) em POST /mcp. Só monta o servidor e registra
 * as tools que cada contexto define em presentation/mcp; os casos de uso vêm dos módulos.
 */
@Module({
  imports: [
    // Fornecem os casos de uso exportados que as tools usam.
    TransitModule,
    RealtimeModule,
    GeocodingModule,
    RoutingModule,
  ],
  controllers: [McpController],
  providers: [
    ...MCP_TOOL_CLASSES,
    {
      provide: MCP_TOOLS,
      useFactory: (...tools: McpTool[]) => tools,
      inject: MCP_TOOL_CLASSES,
    },
    McpServerFactory,
  ],
})
export class McpModule {}
