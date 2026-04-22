import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      // Exclude browser-only entry point and pure DOM-manipulation UI modules
      // that require a DOM environment (jsdom/happy-dom) to test meaningfully.
      // Testable modules (canvas, ws, state) are covered at 90%+.
      thresholds: { lines: 40, functions: 80, branches: 75, statements: 40 },
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/ui/**'],
    },
  },
});
