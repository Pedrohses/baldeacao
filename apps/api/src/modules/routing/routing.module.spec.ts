import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppConfig } from '../../config';
import { PlanTripUseCase } from './application/use-cases/plan-trip.use-case';
import { RoutingModule } from './routing.module';

// No app AppConfig vem do ConfigModule global; aqui um falso basta para ligar as portas.
@Global()
@Module({
  providers: [{ provide: AppConfig, useValue: { otpUrl: undefined } }],
  exports: [AppConfig],
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
