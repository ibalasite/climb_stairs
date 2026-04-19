import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Point @ladder-room/shared to source during tests (avoids needing a pre-build)
      '@ladder-room/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/container.ts'],
    },
  },
});
