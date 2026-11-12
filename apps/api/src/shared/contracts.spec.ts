import { positionsLineChannel, StopSchema } from '@baldeacao/types';

describe('@baldeacao/types', () => {
  it('é importável no Jest da api', () => {
    expect(positionsLineChannel('8000-10')).toContain('8000-10');
    expect(typeof StopSchema.safeParse).toBe('function');
  });
});
