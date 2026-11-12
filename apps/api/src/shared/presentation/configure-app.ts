import type { INestApplication } from '@nestjs/common';
import compression from 'compression';
import { CorsIoAdapter } from './ws/cors-io.adapter';

/**
 * Liga o CORS do REST e do Socket.IO à origem do app web e comprime as respostas
 * (o snapshot de posições tem ~2 MB em JSON e cai para ~190 KB com gzip).
 */
export function configureApp(app: INestApplication, webOrigin: string): void {
  app.enableCors({ origin: webOrigin });
  app.use(compression());
  app.useWebSocketAdapter(new CorsIoAdapter(app, webOrigin));
}
