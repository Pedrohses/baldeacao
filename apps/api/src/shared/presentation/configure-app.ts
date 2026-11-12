import type { INestApplication } from '@nestjs/common';
import compression from 'compression';
import { HttpExceptionFilter } from './http-exception.filter';
import { CorsIoAdapter } from './ws/cors-io.adapter';

/**
 * Liga o CORS do REST e do Socket.IO à origem do app web, comprime as respostas (o snapshot
 * de posições tem ~2 MB em JSON e cai para ~190 KB com gzip) e registra o filtro global que
 * põe todo erro HTTP no formato ApiErrorBody `{ code, message }`.
 */
export function configureApp(app: INestApplication, webOrigin: string): void {
  app.enableCors({ origin: webOrigin });
  app.use(compression());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useWebSocketAdapter(new CorsIoAdapter(app, webOrigin));
}
