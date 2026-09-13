import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  build: {
    rollupOptions: { input: { main: resolve('index.html'), browser: resolve('browser.html') } },
  },
  test: { include: ['**/*.test.ts'], environment: 'node' },
});
