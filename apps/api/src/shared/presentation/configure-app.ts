import type { INestApplication } from '@nestjs/common';
import { CorsIoAdapter } from './ws/cors-io.adapter';

/** Liga o CORS do REST e do Socket.IO à origem do app web. Usado no main.ts e nos testes. */
export function configureApp(app: INestApplication, webOrigin: string): void {
  app.enableCors({ origin: webOrigin });
  app.useWebSocketAdapter(new CorsIoAdapter(app, webOrigin));
}
