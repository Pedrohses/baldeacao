import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// O .env fica na raiz do monorepo, compartilhado com a api. O Next só lê .env da pasta do app,
// então carregamos o da raiz aqui (variáveis já definidas no ambiente têm prioridade) e
// repassamos as NEXT_PUBLIC_* em `env` para serem embutidas no bundle do cliente.
// A validação continua em src/shared/config/env.ts.
const rootEnvFile = resolve(__dirname, '../../.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const PUBLIC_ENV_KEYS = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_WS_URL',
  'NEXT_PUBLIC_MAP_STYLE_URL',
] as const;

const publicEnv = Object.fromEntries(
  PUBLIC_ENV_KEYS.flatMap((key) => {
    const value = process.env[key];
    return value === undefined ? [] : [[key, value]];
  }),
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: publicEnv,
};

export default nextConfig;
