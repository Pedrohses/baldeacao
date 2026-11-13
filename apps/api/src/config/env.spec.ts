import { envSchema } from './env';

const base = { DATABASE_URL: 'postgres://teste', REDIS_URL: 'redis://teste' };

describe('TRUSTED_PROXIES', () => {
  it('vazio ou ausente vira lista vazia', () => {
    expect(envSchema.parse(base).TRUSTED_PROXIES).toEqual([]);
    expect(envSchema.parse({ ...base, TRUSTED_PROXIES: '' }).TRUSTED_PROXIES).toEqual([]);
  });

  it('aceita IPs e faixas CIDR separados por vírgula', () => {
    const env = envSchema.parse({ ...base, TRUSTED_PROXIES: '172.18.0.0/16, 10.0.0.9,::1' });
    expect(env.TRUSTED_PROXIES).toEqual(['172.18.0.0/16', '10.0.0.9', '::1']);
  });

  it('recusa valor que não é IP', () => {
    expect(envSchema.safeParse({ ...base, TRUSTED_PROXIES: 'caddy' }).success).toBe(false);
  });
});
