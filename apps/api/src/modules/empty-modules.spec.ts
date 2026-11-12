import { Test } from '@nestjs/testing';
import { RealtimeModule } from './realtime/realtime.module';
import { SourcesModule } from './sources/sources.module';
import { TransitModule } from './transit/transit.module';

describe('empty context modules', () => {
  it('compiles transit, sources and realtime modules', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TransitModule, SourcesModule, RealtimeModule],
    }).compile();

    expect(moduleRef.get(TransitModule)).toBeInstanceOf(TransitModule);
    expect(moduleRef.get(SourcesModule)).toBeInstanceOf(SourcesModule);
    expect(moduleRef.get(RealtimeModule)).toBeInstanceOf(RealtimeModule);
    await moduleRef.close();
  });
});
