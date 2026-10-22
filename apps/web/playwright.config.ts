import { defineConfig, devices } from '@playwright/test';

// E2E는 모바일 뷰포트 기준 (docs/conventions/testing.md). iPhone(WebKit)은 실기기 테스트 단계에서 추가.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [{ name: 'Pixel 7', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
