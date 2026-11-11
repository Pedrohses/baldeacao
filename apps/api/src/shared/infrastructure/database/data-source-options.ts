import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { AppConfig } from '../../../config';

export function buildDataSourceOptions(config: AppConfig): DataSourceOptions {
  return {
    type: 'postgres',
    url: config.databaseUrl,
    synchronize: false,
    entities: [
      join(__dirname, '../../../modules/**/infrastructure/persistence/*.orm-entity.{ts,js}'),
    ],
    migrations: [join(__dirname, '../../../database/migrations/*.{ts,js}')],
  };
}
