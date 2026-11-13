import { type ExecutionContext, Injectable, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfig } from '../../../config/app-config';
import { clientIp, type ClientIpRequest, TrustedProxies } from './client-ip';
import { HEAVY_ROUTE } from './heavy-route.decorator';
import { MCP_PATH_PREFIX, THROTTLES, UNLIMITED_PATH_PREFIXES } from './throttles';

function requestPath(context: ExecutionContext): string {
  const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
  return req.path ?? req.url ?? '';
}

const isMcp = (context: ExecutionContext) => requestPath(context).startsWith(MCP_PATH_PREFIX);

const isHeavy = (context: ExecutionContext) =>
  Reflect.getMetadata(HEAVY_ROUTE, context.getHandler()) === true;

/** Só HTTP: o WebSocket das posições tem o seu próprio controle de assinatura. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  override canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return Promise.resolve(true);
    const path = requestPath(context);
    if (UNLIMITED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return Promise.resolve(true);
    }
    return super.canActivate(context);
  }
}

/** Limite por IP da api inteira (REST e MCP), com o IP real atrás de proxy confiável. */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const trusted = new TrustedProxies(config.trustedProxies);
        return {
          throttlers: [
            { ...THROTTLES.api, skipIf: isMcp },
            { ...THROTTLES.heavy, skipIf: (context) => isMcp(context) || !isHeavy(context) },
            { ...THROTTLES.mcp, skipIf: (context) => !isMcp(context) },
          ],
          getTracker: (req) => Promise.resolve(clientIp(req as ClientIpRequest, trusted)),
        };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class ThrottlingModule {}
