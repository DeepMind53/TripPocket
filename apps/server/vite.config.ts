/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * 서버 빌드: src/index.ts → dist/index.js 하나로 (shared 포함, node_modules는 그대로 import).
 * 별도 빌드 도구 없이 웹과 같은 Vite를 쓴다.
 */
export default defineConfig({
  build: {
    ssr: 'src/index.ts',
    outDir: 'dist',
    target: 'node24',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'index.js' } },
  },
  ssr: { noExternal: ['@trippocket/shared'] },
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
});
