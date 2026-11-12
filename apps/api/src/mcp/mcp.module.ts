import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import { MCP_THROTTLE, McpThrottlerGuard } from './mcp-throttler.guard';
import type { McpTool } from './mcp-tool';
import { MCP_TOOL_CLASSES, MCP_TOOLS } from './mcp-tools';

/**
 * Servidor MCP (Streamable HTTP, stateless) em POST /mcp. Só monta o servidor e registra
 * as tools que cada contexto define em presentation/mcp; os casos de uso vêm dos módulos.
 */
@Module({
  imports: [
    // O guard fica só no McpController: o resto da API não tem esse limite.
    ThrottlerModule.forRoot({ throttlers: [{ ...MCP_THROTTLE }] }),
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
    McpThrottlerGuard,
  ],
})
export class McpModule {}
