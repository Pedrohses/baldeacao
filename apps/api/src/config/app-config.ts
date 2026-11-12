import type { Env } from './env';

export class AppConfig {
  constructor(private readonly env: Env) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get port(): number {
    return this.env.PORT;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }

  get olhoVivoToken(): string | undefined {
    return this.env.OLHOVIVO_TOKEN;
  }

  get olhoVivoUserAgent(): string {
    return this.env.OLHOVIVO_USER_AGENT;
  }

  get webOrigin(): string {
    return this.env.WEB_ORIGIN;
  }
}
