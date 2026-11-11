import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'scripts/**', '*.config.{js,mjs}'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Configuração só via src/config (validada com Zod).
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Leia configuração por src/config.' },
      ],
    },
  },
  {
    files: ['src/config/**/*.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    // domain/ não conhece framework nem infraestrutura.
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', 'typeorm', 'ioredis', 'pg', '@modelcontextprotocol/*'],
              message: 'domain/ não importa framework nem infraestrutura.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
);
