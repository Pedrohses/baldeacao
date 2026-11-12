import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { readStorage, removeStorage, writeStorage } from './storage';

const schema = z.object({ count: z.number() });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('storage', () => {
  it('grava com prefixo e lê validando pelo schema', () => {
    expect(writeStorage('demo', { count: 2 })).toBe(true);
    expect(localStorage.getItem('baldeacao:demo')).toBe('{"count":2}');
    expect(readStorage('demo', schema)).toEqual({ count: 2 });
    removeStorage('demo');
    expect(readStorage('demo', schema)).toBeNull();
  });

  it('trata JSON corrompido ou fora do schema como ausente', () => {
    localStorage.setItem('baldeacao:demo', '{quebrado');
    expect(readStorage('demo', schema)).toBeNull();
    localStorage.setItem('baldeacao:demo', '{"count":"2"}');
    expect(readStorage('demo', schema)).toBeNull();
  });

  it('não lança quando o navegador recusa gravar', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });
    expect(writeStorage('demo', { count: 1 })).toBe(false);
  });
});
