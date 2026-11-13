import { MinIntervalScheduler, SchedulerFullError } from './min-interval-scheduler';

/** Relógio e espera falsos: o tempo só anda quando a fila "dorme". */
function fakeTime() {
  let now = 0;
  return {
    now: () => now,
    sleep: (ms: number) => {
      now += ms;
      return Promise.resolve();
    },
  };
}

describe('MinIntervalScheduler', () => {
  it('espera o intervalo entre o início de uma tarefa e o da seguinte', async () => {
    const time = fakeTime();
    const scheduler = new MinIntervalScheduler(1000, time.now, time.sleep);
    const starts: number[] = [];
    const task = () => {
      starts.push(time.now());
      return Promise.resolve();
    };
    await Promise.all([
      scheduler.schedule(task),
      scheduler.schedule(task),
      scheduler.schedule(task),
    ]);
    expect(starts).toEqual([0, 1000, 2000]);
  });

  it('recusa na hora a tarefa que passaria do limite de fila e libera vaga quando uma termina', async () => {
    const time = fakeTime();
    const scheduler = new MinIntervalScheduler(1000, time.now, time.sleep, 2);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => (release = resolve));

    const first = scheduler.schedule(() => blocked);
    const second = scheduler.schedule(() => Promise.resolve('b'));
    expect(scheduler.pending).toBe(2);
    await expect(scheduler.schedule(() => Promise.resolve('c'))).rejects.toBeInstanceOf(
      SchedulerFullError,
    );

    release();
    await first;
    await expect(second).resolves.toBe('b');
    expect(scheduler.pending).toBe(0);
    await expect(scheduler.schedule(() => Promise.resolve('d'))).resolves.toBe('d');
  });

  it('tarefa que falha também libera a vaga', async () => {
    const time = fakeTime();
    const scheduler = new MinIntervalScheduler(1000, time.now, time.sleep, 1);
    await expect(scheduler.schedule(() => Promise.reject(new Error('falhou')))).rejects.toThrow(
      'falhou',
    );
    expect(scheduler.pending).toBe(0);
    await expect(scheduler.schedule(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});
