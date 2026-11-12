import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../config';
import { REDIS_CLIENT } from '../../shared/infrastructure/redis/redis.module';
import { PlanTripUseCase } from './application/use-cases/plan-trip.use-case';
import { RoutingModule } from './routing.module';

// No app DataSource, Redis e AppConfig vêm de módulos globais; aqui falsos bastam para ligar
// as portas (o routing importa o transit, para os avisos de área de atendimento).
@Global()
@Module({
  providers: [
    { provide: DataSource, useValue: { getRepository: () => ({}) } },
    { provide: REDIS_CLIENT, useValue: {} },
    {
      provide: AppConfig,
      useValue: { otpUrl: undefined, olhoVivoToken: undefined, olhoVivoUserAgent: 'test' },
    },
  ],
  exports: [DataSource, REDIS_CLIENT, AppConfig],
})
class FakeConfigModule {}

@Module({ imports: [RoutingModule] })
class ConsumerModule {}

describe('RoutingModule', () => {
  it('liga as portas (mesmo sem OTP_URL) e exporta PlanTripUseCase', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeConfigModule, ConsumerModule],
    }).compile();
    expect(moduleRef.select(ConsumerModule).get(PlanTripUseCase)).toBeInstanceOf(PlanTripUseCase);
    await moduleRef.close();
  });
});
