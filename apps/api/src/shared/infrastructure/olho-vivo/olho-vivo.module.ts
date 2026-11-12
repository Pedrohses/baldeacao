import { Module } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { OlhoVivoClient } from './olho-vivo.client';

@Module({
  providers: [
    {
      provide: OlhoVivoClient,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        new OlhoVivoClient({
          token: config.olhoVivoToken,
          userAgent: config.olhoVivoUserAgent,
        }),
    },
  ],
  exports: [OlhoVivoClient],
})
export class OlhoVivoModule {}
