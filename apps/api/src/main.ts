import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config';
import { configureApp } from './shared/presentation/configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfig);
  configureApp(app, config.webOrigin);
  app.enableShutdownHooks();
  await app.listen(config.port);
}

void bootstrap();
