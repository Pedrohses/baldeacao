// Postgres + PostGIS descartável (Testcontainers) com as migrações do projeto aplicadas.
// Mesma imagem do infra/docker-compose.yml.
import { join } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AppConfig, loadEnv } from '../../src/config';
import { buildDataSourceOptions } from '../../src/shared/infrastructure/database/data-source-options';

export const POSTGIS_IMAGE = 'postgis/postgis:18-3.7';
export const POSTGIS_TEST_TIMEOUT_MS = 180_000;
export const GTFS_MINI_DIR = join(__dirname, '..', 'fixtures', 'gtfs', 'sptrans-mini');

export interface PostgisTestDatabase {
  dataSource: DataSource;
  stop(): Promise<void>;
}

export async function startPostgis(): Promise<PostgisTestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    POSTGIS_IMAGE,
  ).start();
  const config = new AppConfig(
    loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL: container.getConnectionUri(),
      // Não usado: só satisfaz o schema do .env.
      REDIS_URL: 'redis://localhost:6379',
    }),
  );
  const dataSource = new DataSource(buildDataSourceOptions(config));
  await dataSource.initialize();
  await dataSource.runMigrations();
  return {
    dataSource,
    stop: async () => {
      await dataSource.destroy();
      await container.stop();
    },
  };
}
