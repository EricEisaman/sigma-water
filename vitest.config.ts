import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'client/**/*.test.ts'],
    globals: true,
    clearMocks: true,
    restoreMocks: true,
  },
});
