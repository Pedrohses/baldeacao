import { Injectable } from '@nestjs/common';
import { CacheHealthPort } from '../../domain/ports/cache-health.port';
import { DatabaseHealthPort } from '../../domain/ports/database-health.port';
import type { DependencyStatus, HealthReport } from '../dto/health-report.dto';

@Injectable()
export class CheckHealthUseCase {
  constructor(
    private readonly database: DatabaseHealthPort,
    private readonly cache: CacheHealthPort,
  ) {}

  async execute(): Promise<HealthReport> {
    const [postgres, redis] = await Promise.all([
      toStatus(this.database.isUp()),
      toStatus(this.cache.isUp()),
    ]);

    return {
      status: postgres === 'up' && redis === 'up' ? 'ok' : 'error',
      checks: { postgres, redis },
    };
  }
}

async function toStatus(check: Promise<boolean>): Promise<DependencyStatus> {
  try {
    return (await check) ? 'up' : 'down';
  } catch {
    return 'down';
  }
}
