import { envSchema } from './env';

describe('envSchema', () => {
  it('aceita as URLs do .env.example', () => {
    const result = envSchema.safeParse({
      apiUrl: 'http://localhost:3001',
      wsUrl: 'http://localhost:3001',
      mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    });

    expect(result.success).toBe(true);
  });

  it('rejeita variável ausente', () => {
    const result = envSchema.safeParse({
      apiUrl: 'http://localhost:3001',
      wsUrl: 'http://localhost:3001',
    });

    expect(result.success).toBe(false);
  });
});
