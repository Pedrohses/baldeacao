const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fila do processo: roda uma tarefa por vez e começa cada uma pelo menos `intervalMs` depois
 * do início da anterior (1 req/s do Nominatim). Falha de uma tarefa não trava a fila.
 */
export class MinIntervalScheduler {
  private tail: Promise<void> = Promise.resolve();
  private lastStartAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {}

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const waitMs = this.lastStartAt + this.intervalMs - this.now();
      if (waitMs > 0) await this.sleep(waitMs);
      this.lastStartAt = this.now();
      return task();
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
