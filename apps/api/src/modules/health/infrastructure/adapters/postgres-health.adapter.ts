import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { withTimeout } from '../../../../shared/infrastructure/with-timeout';
import { DatabaseHealthPort } from '../../domain/ports/database-health.port';

const TIMEOUT_MS = 2_000;

@Injectable()
export class PostgresHealthAdapter extends DatabaseHealthPort {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async isUp(): Promise<boolean> {
    if (!this.dataSource.isInitialized) return false;
    await withTimeout(this.dataSource.query('SELECT 1'), TIMEOUT_MS);
    return true;
  }
}
