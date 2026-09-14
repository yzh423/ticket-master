import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  server: {
    watch: { ignored: ['**/.test-data/**', '**/.test-artifacts/**', '**/release/**'] },
  },
  build: {
    rollupOptions: { input: { main: resolve('index.html'), browser: resolve('browser.html') } },
  },
  test: { include: ['**/*.test.ts'], environment: 'node' },
});
