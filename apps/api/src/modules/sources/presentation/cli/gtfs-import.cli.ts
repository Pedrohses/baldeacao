// Uso: pnpm --filter api gtfs:import <pasta-do-gtfs> [--source sptrans]
//      pnpm --filter api gtfs:import --url   (baixa o zip da SPTrans, só reimporta se mudou)
// O caminho relativo é resolvido a partir de apps/api (onde o pnpm roda o script).
import 'reflect-metadata';
import { resolve } from 'node:path';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '../../../../config';
import { DomainError } from '../../../../shared/domain/errors/domain-error';
import { DatabaseModule } from '../../../../shared/infrastructure/database/database.module';
import { RedisModule } from '../../../../shared/infrastructure/redis/redis.module';
import { ImportGtfsFeedUseCase } from '../../application/use-cases/import-gtfs-feed.use-case';
import { RefreshGtfsFeedUseCase } from '../../application/use-cases/refresh-gtfs-feed.use-case';
import { SourcesCoreModule } from '../../sources-core.module';

const DEFAULT_SOURCE = 'sptrans';

@Module({ imports: [ConfigModule, DatabaseModule, RedisModule, SourcesCoreModule] })
class GtfsImportCliModule {}

export function parseArgs(argv: string[]): {
  location: string | null;
  sourceId: string;
  fromUrl: boolean;
} {
  let location: string | undefined;
  let sourceId = DEFAULT_SOURCE;
  let fromUrl = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url') {
      fromUrl = true;
    } else if (arg === '--source') {
      sourceId = argv[++i] ?? '';
    } else if (arg !== undefined && arg !== '--') {
      location ??= arg;
    }
  }
  // Com caminho de pasta, importa a pasta; --url sozinho baixa o zip configurado.
  if (!sourceId || (!location && !fromUrl)) {
    throw new Error(
      'Uso: pnpm --filter api gtfs:import <pasta-do-gtfs> [--source sptrans] | gtfs:import --url',
    );
  }
  return { location: location ? resolve(location) : null, sourceId, fromUrl };
}

async function main(): Promise<void> {
  const logger = new Logger('GtfsImport');
  const input = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(GtfsImportCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    if (input.location === null) {
      // O caso de uso já registra o resultado (inalterado / importado / falha).
      await app.get(RefreshGtfsFeedUseCase).execute(input.sourceId);
      return;
    }
    logger.log(`Importando ${input.location} como fonte "${input.sourceId}"...`);
    const result = await app
      .get(ImportGtfsFeedUseCase)
      .execute({ sourceId: input.sourceId, location: input.location });
    const counts = Object.entries(result.counts)
      .map(([table, total]) => `${table}=${total}`)
      .join(' ');
    logger.log(`Concluído em ${result.durationMs} ms: ${counts}`);
    if (result.skippedShapes.length > 0) {
      logger.warn(`Shapes com menos de 2 pontos ignorados: ${result.skippedShapes.join(', ')}`);
    }
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message =
      error instanceof DomainError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    new Logger('GtfsImport').error(message);
    process.exitCode = 1;
  });
}
