import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Limite por IP das rotas do MCP: 60 requisições por minuto. */
export const MCP_THROTTLE = { name: 'mcp', ttl: 60_000, limit: 60 } as const;

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Throttler do MCP. O Claude chega pelo Cloudflare Tunnel, que roda na mesma máquina e
 * conecta por loopback: nesse caso o IP real vem em `CF-Connecting-IP`. De qualquer outro
 * endereço o cabeçalho é ignorado, para ninguém fugir do limite forjando o IP.
 */
@Injectable()
export class McpThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(clientIp(req));
  }
}

export function clientIp(req: Record<string, unknown>): string {
  const socket = req.socket as { remoteAddress?: string } | undefined;
  const remote = socket?.remoteAddress ?? 'desconhecido';
  const headers = req.headers as Record<string, string | string[] | undefined> | undefined;
  const forwarded = headers?.['cf-connecting-ip'];
  if (LOOPBACK.has(remote) && typeof forwarded === 'string' && forwarded.trim() !== '') {
    return forwarded.trim();
  }
  return remote;
}
