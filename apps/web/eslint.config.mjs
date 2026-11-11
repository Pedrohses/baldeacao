import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Variáveis de ambiente só em shared/config/env.ts.
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Leia variáveis por @/shared/config/env.' },
      ],
    },
  },
  {
    files: ['src/shared/config/**', 'next.config.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    // shared/ não conhece features/.
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/features/*'], message: 'shared/ não importa de features/.' }] },
      ],
    },
  },
]);
