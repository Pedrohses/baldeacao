import { Module } from '@nestjs/common';
import { loadEnv } from '../../../config';
import { OlhoVivoClient } from './olho-vivo.client';

@Module({
  providers: [
    {
      provide: OlhoVivoClient,
      useFactory: () => {
        const env = loadEnv();
        return new OlhoVivoClient({
          token: env.OLHOVIVO_TOKEN,
          userAgent: env.OLHOVIVO_USER_AGENT,
        });
      },
    },
  ],
  exports: [OlhoVivoClient],
})
export class OlhoVivoModule {}
