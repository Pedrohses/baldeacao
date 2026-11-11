// Uso: pnpm --filter api migration:generate <Nome>
import { spawnSync } from 'node:child_process';

const name = process.argv[2];
if (!name || !/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
  console.error(
    'Informe o nome da migração em PascalCase. Ex.: pnpm --filter api migration:generate CreateStops',
  );
  process.exit(1);
}

const result = spawnSync(
  'pnpm',
  ['typeorm', 'migration:generate', `src/database/migrations/${name}`],
  {
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
