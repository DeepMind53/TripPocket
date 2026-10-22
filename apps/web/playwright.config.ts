import { defineConfig, devices } from '@playwright/test';

// E2E는 모바일 뷰포트 기준 (docs/conventions/testing.md). iPhone(WebKit)은 실기기 테스트 단계에서 추가.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] }, testIgnore: /\.prod\.spec\.ts$/ },
    // 오프라인·서비스 워커는 배포 빌드에서만 (pnpm build && pnpm preview)
    {
      name: 'prod',
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4173' },
      testMatch: /\.prod\.spec\.ts$/,
    },
  ],
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm build && pnpm preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
