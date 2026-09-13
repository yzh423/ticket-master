import { defineConfig } from 'vitest/config';
export default defineConfig({
  base: './',
  test: { include: ['**/*.test.ts'], environment: 'node' },
});
