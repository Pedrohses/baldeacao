import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthReport } from '../../application/dto/health-report.dto';
import { CheckHealthUseCase } from '../../application/use-cases/check-health.use-case';

@Controller('health')
export class HealthController {
  constructor(private readonly checkHealth: CheckHealthUseCase) {}

  @Get()
  async check(): Promise<HealthReport> {
    const report = await this.checkHealth.execute();
    if (report.status !== 'ok') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
