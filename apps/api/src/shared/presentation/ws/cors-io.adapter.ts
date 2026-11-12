import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

type IoServerOptions = NonNullable<Parameters<IoAdapter['createIOServer']>[1]>;

/** Adapter do Socket.IO com o CORS vindo da configuração (WEB_ORIGIN), não fixo no gateway. */
export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origin: string,
  ) {
    super(app);
  }

  override createIOServer(
    port: number,
    options?: IoServerOptions,
  ): ReturnType<IoAdapter['createIOServer']> {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origin },
    } as IoServerOptions);
  }
}
