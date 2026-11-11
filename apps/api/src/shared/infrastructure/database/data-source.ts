// DataSource usado pelo CLI do TypeORM (migration:generate, migration:run).
import { DataSource } from 'typeorm';
import { AppConfig, loadEnv } from '../../../config';
import { buildDataSourceOptions } from './data-source-options';

export default new DataSource(buildDataSourceOptions(new AppConfig(loadEnv())));
