// Uso: pnpm --filter api places:import <arquivo.osm.pbf>
//      ex.: pnpm --filter api places:import ../../infra/otp/data/sao-paulo.osm.pbf
// Extrai os lugares conhecidos (parques, museus, hospitais...) com osmium num container Docker
// e substitui a tabela places. O caminho relativo é resolvido a partir de apps/api.
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '../../../../config';
import { DomainError } from '../../../../shared/domain/errors/domain-error';
import { DatabaseModule } from '../../../../shared/infrastructure/database/database.module';
import { ImportKnownPlacesUseCase } from '../../application/use-cases/import-known-places.use-case';
import { PlacesImportModule } from '../../places-import.module';

@Module({ imports: [ConfigModule, DatabaseModule, PlacesImportModule] })
class PlacesImportCliModule {}

export function parseArgs(argv: string[]): { pbfPath: string } {
  const file = argv.find((arg) => arg !== '--');
  if (!file) throw new Error('Uso: pnpm --filter api places:import <arquivo.osm.pbf>');
  const pbfPath = resolve(file);
  if (!existsSync(pbfPath)) throw new Error(`Arquivo não encontrado: ${pbfPath}`);
  return { pbfPath };
}

async function main(): Promise<void> {
  const logger = new Logger('PlacesImport');
  const input = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(PlacesImportCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    logger.log(`Extraindo lugares de ${input.pbfPath} (osmium via Docker)...`);
    const result = await app.get(ImportKnownPlacesUseCase).execute(input);
    logger.log(
      `Concluído em ${result.durationMs} ms: ${result.imported} lugares importados ` +
        `(${result.extracted} extraídos, ${result.skipped} sem nome ou fora das categorias); ` +
        `limite do município ${result.cityBoundary ? 'importado' : 'não encontrado'}.`,
    );
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
    new Logger('PlacesImport').error(message);
    process.exitCode = 1;
  });
}
