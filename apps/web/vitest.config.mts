import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Mesmos valores do .env.example; testes nunca dependem do .env local.
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_WS_URL: 'http://localhost:3001',
      NEXT_PUBLIC_MAP_STYLE_URL: 'https://tiles.openfreemap.org/styles/liberty',
    },
  },
});
