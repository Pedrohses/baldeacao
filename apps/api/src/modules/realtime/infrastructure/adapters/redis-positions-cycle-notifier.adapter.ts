import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { z } from 'zod';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/redis.module';
import {
  PositionsCycleNotifierPort,
  type PositionsCycleEvent,
  type PositionsCycleListener,
} from '../../domain/ports/positions-cycle-notifier.port';
import { realtimeKeys } from './redis-keys';

const CycleEventSchema = z.object({
  sourceId: z.string().min(1),
  updatedAt: z.string().min(1),
  vehicleCount: z.number().int().nonnegative(),
});

/** Pub/sub positions:{source}: o worker publica, o gateway de cada instância escuta. */
@Injectable()
export class RedisPositionsCycleNotifierAdapter
  extends PositionsCycleNotifierPort
  implements OnModuleDestroy
{
  private readonly logger = new Logger(RedisPositionsCycleNotifierAdapter.name);
  private readonly listeners = new Set<PositionsCycleListener>();
  private subscriber: Redis | undefined;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async publish(event: PositionsCycleEvent): Promise<void> {
    await this.redis.publish(realtimeKeys.cycleChannel(event.sourceId), JSON.stringify(event));
  }

  async subscribe(listener: PositionsCycleListener): Promise<() => Promise<void>> {
    this.listeners.add(listener);
    await this.ensureSubscriber();
    return () => {
      this.listeners.delete(listener);
      return Promise.resolve();
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.listeners.clear();
    const subscriber = this.subscriber;
    this.subscriber = undefined;
    await subscriber?.quit().catch(() => subscriber.disconnect());
  }

  private async ensureSubscriber(): Promise<void> {
    if (this.subscriber) return;
    // Conexão em modo subscriber é exclusiva; a fila offline segura o PSUBSCRIBE até conectar.
    const subscriber = this.redis.duplicate({
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
    });
    this.subscriber = subscriber;
    subscriber.on('error', (error: Error) => this.logger.warn(error.message));
    subscriber.on('pmessage', (_pattern: string, _channel: string, message: string) =>
      this.dispatch(message),
    );
    await subscriber.psubscribe(realtimeKeys.cycleChannelPattern);
  }

  private dispatch(message: string): void {
    let event: PositionsCycleEvent;
    try {
      event = CycleEventSchema.parse(JSON.parse(message));
    } catch {
      this.logger.warn('Mensagem de ciclo inválida ignorada.');
      return;
    }
    for (const listener of this.listeners) listener(event);
  }
}
