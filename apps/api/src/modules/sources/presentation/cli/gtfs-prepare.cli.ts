// Uso: pnpm --filter api gtfs:prepare <entrada.zip|pasta> <saida.zip>
// Gera o GTFS do OTP: traçados reparados (mesmo reparo do gtfs:import) e exact_times=1.
// Não abre banco nem Redis. Caminhos relativos são resolvidos a partir de apps/api.
import 'reflect-metadata';
import { resolve } from 'node:path';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DomainError } from '../../../../shared/domain/errors/domain-error';
import { PrepareGtfsArchiveUseCase } from '../../application/use-cases/prepare-gtfs-archive.use-case';
import { RepairGtfsShapesUseCase } from '../../application/use-cases/repair-gtfs-shapes.use-case';
import type { ShapeRepairAction } from '../../domain/services/repair-shapes';
import { GtfsArchiveFiles } from '../../domain/ports/gtfs-archive-files.port';
import { GtfsFeedReader } from '../../domain/ports/gtfs-feed-reader.port';
import { CsvGtfsFeedReader } from '../../infrastructure/adapters/csv-gtfs-feed-reader.adapter';
import { FsGtfsArchiveFiles } from '../../infrastructure/adapters/fs-gtfs-archive-files.adapter';

@Module({
  providers: [
    PrepareGtfsArchiveUseCase,
    RepairGtfsShapesUseCase,
    { provide: GtfsFeedReader, useClass: CsvGtfsFeedReader },
    { provide: GtfsArchiveFiles, useClass: FsGtfsArchiveFiles },
  ],
})
class GtfsPrepareCliModule {}

export function parseArgs(argv: string[]): { input: string; output: string } {
  const [input, output] = argv.filter((arg) => arg !== '--');
  if (!input || !output) {
    throw new Error('Uso: pnpm --filter api gtfs:prepare <entrada.zip|pasta> <saida.zip>');
  }
  return { input: resolve(input), output: resolve(output) };
}

/** Resumo por tipo de reparo, com os maiores casos de trilho por extenso. */
export function summarize(actions: ShapeRepairAction[]): string[] {
  const byKind = new Map<string, ShapeRepairAction[]>();
  for (const action of actions)
    byKind.set(action.kind, [...(byKind.get(action.kind) ?? []), action]);
  return [...byKind].map(([kind, list]) => {
    const top = [...list]
      .sort((a, b) => b.meters - a.meters)
      .slice(0, 6)
      .map((a) => `${a.shapeId} ${a.meters} m${a.borrowedFrom ? ` (de ${a.borrowedFrom})` : ''}`);
    return `${kind}: ${list.length}; maiores: ${top.join(', ')}`;
  });
}

async function main(): Promise<void> {
  const logger = new Logger('GtfsPrepare');
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(GtfsPrepareCliModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    logger.log(`Preparando ${args.input} -> ${args.output}...`);
    const result = await app.get(PrepareGtfsArchiveUseCase).execute(args);
    logger.log(
      `Zip gravado (${(result.bytes / 1e6).toFixed(1)} MB): ${result.shapes} shapes, ` +
        `${result.exactFrequencies} faixas com exact_times=1.`,
    );
    for (const line of summarize(result.shapeRepairs)) logger.log(line);
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
    new Logger('GtfsPrepare').error(message);
    process.exitCode = 1;
  });
}
