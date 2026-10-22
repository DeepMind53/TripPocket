/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * 서비스 워커 생성 (라이브러리 없이): 빌드 결과 파일 목록을 src/sw/sw-template.js에 넣어 dist/sw.js로.
 * 글꼴(woff2)은 미리 받지 않고 쓸 때 저장 — Pretendard 조각이 많아(약 3MB) 설치가 무거워지므로
 */
function serviceWorker(): Plugin {
  return {
    name: 'trippocket-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const icons = readdirSync('public/icons')
        .filter((f) => f.endsWith('.png'))
        .map((f) => `/icons/${f}`);
      const files = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map') && !f.endsWith('.woff2') && f !== 'sw.js')
        .map((f) => `/${f}`)
        .filter((f) => f !== '/index.html')
        .concat('/index.html', '/boot.js', '/manifest.webmanifest', ...icons)
        .sort();
      const version = createHash('sha256').update(files.join(' ')).digest('hex').slice(0, 12);
      const source = readFileSync('src/sw/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

function devApiProxy() {
  const secret = process.env.TP_PROXY_SECRET;
  if (!secret) return {};
  const target = { target: 'http://127.0.0.1:8787', headers: { 'x-tp-proxy': secret } };
  return { proxy: { '/api': target, '/auth': target } };
}

/** public/_headers 의 "/*" 블록을 읽는다 */
function pagesHeaders(): Record<string, string> {
  const block = readFileSync('public/_headers', 'utf8')
    .split(/\n(?=\S)/)
    .find((b) => b.startsWith('/*'));
  return Object.fromEntries(
    (block ?? '')
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]),
  );
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  // 개발 중에는 Cloudflare Pages 프록시 대신 Vite가 홈 서버(127.0.0.1:8787)로 전달 (ADR-0006)
  server: { port: 5173, strictPort: true, ...devApiProxy() },
  // 배포(Cloudflare Pages)와 같은 보안 헤더로 미리보기 → E2E에서 CSP 위반을 잡는다
  preview: { port: 4173, strictPort: true, headers: pagesHeaders() },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // 화면 흐름 테스트가 여러 개 동시에 돌면 5초를 넘길 수 있다
    testTimeout: 15_000,
  },
});
