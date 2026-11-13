const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** A fila já tem `maxPending` tarefas esperando: a nova é recusada na hora, sem entrar. */
export class SchedulerFullError extends Error {
  constructor(readonly maxPending: number) {
    super(`Fila cheia: ${maxPending} tarefas já esperando.`);
    this.name = 'SchedulerFullError';
  }
}

/**
 * Fila do processo: roda uma tarefa por vez e começa cada uma pelo menos `intervalMs` depois
 * do início da anterior (1 req/s do Nominatim). Falha de uma tarefa não trava a fila.
 * Com `maxPending`, recusa tarefas novas quando já há essa quantidade na fila (contando a que
 * está rodando): sem isso, um pico de buscas faria a espera e a memória crescerem sem limite.
 */
export class MinIntervalScheduler {
  private tail: Promise<void> = Promise.resolve();
  private lastStartAt = Number.NEGATIVE_INFINITY;
  private pendingCount = 0;

  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
    private readonly maxPending: number = Number.POSITIVE_INFINITY,
  ) {}

  /** Tarefas na fila, incluindo a que está rodando. */
  get pending(): number {
    return this.pendingCount;
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    if (this.pendingCount >= this.maxPending) {
      return Promise.reject(new SchedulerFullError(this.maxPending));
    }
    this.pendingCount += 1;
    const run = this.tail.then(async () => {
      const waitMs = this.lastStartAt + this.intervalMs - this.now();
      if (waitMs > 0) await this.sleep(waitMs);
      this.lastStartAt = this.now();
      return task();
    });
    const settle = () => {
      this.pendingCount -= 1;
    };
    this.tail = run.then(settle, settle);
    return run;
  }
}
