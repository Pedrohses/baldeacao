import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Campos vazios no .env (ex.: OLHOVIVO_TOKEN=) contam como ausentes.
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);
const optionalUrl = z.preprocess((value) => (value === '' ? undefined : value), z.url().optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  OLHOVIVO_TOKEN: optionalString,
  OLHOVIVO_USER_AGENT: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().default('baldeacao/0.1'),
  ),
  OTP_URL: optionalUrl,
  GTFS_SPTRANS_URL: z
    .url()
    .default('https://www.sptrans.com.br/umbraco/Surface/PerfilDesenvolvedor/BaixarGTFS?memberName=sptrans'),
  GTFS_SPTRANS_FALLBACK_URL: z.url().default('https://files.mobilitydatabase.org/mdb-8/latest.zip'),
  // Toda segunda às 4h (horário de São Paulo, ver o job).
  GTFS_REFRESH_CRON: z.string().min(1).default('0 4 * * 1'),
  NOMINATIM_USER_AGENT: optionalString,
});

export type Env = z.infer<typeof envSchema>;

// .env fica na raiz do monorepo; variáveis já definidas no ambiente têm prioridade.
const ROOT_ENV_FILE = resolve(__dirname, '../../../../.env');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env && existsSync(ROOT_ENV_FILE)) {
    process.loadEnvFile(ROOT_ENV_FILE);
  }

  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
