/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * 서버 빌드: src/index.ts → dist/index.js 하나로 (shared 포함, node_modules는 그대로 import).
 * 별도 빌드 도구 없이 웹과 같은 Vite를 쓴다.
 */
export default defineConfig({
  build: {
    // 서버 + 운영 도구(백업·복구)
    ssr: true,
    outDir: 'dist',
    target: 'node24',
    emptyOutDir: true,
    rollupOptions: {
      input: { index: 'src/index.ts', backup: 'src/cli/backup.ts', restore: 'src/cli/restore.ts' },
      output: { entryFileNames: '[name].js' },
    },
  },
  ssr: { noExternal: ['@trippocket/shared'] },
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
});
