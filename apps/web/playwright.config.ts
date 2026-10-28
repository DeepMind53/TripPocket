import { defineConfig, devices } from '@playwright/test';

// E2E는 모바일 뷰포트 기준 (docs/conventions/testing.md). 배포 빌드 시험은 갤럭시(Chromium)·아이폰(WebKit) 둘 다.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  // 날짜를 다루는 시험이 많아 브라우저 시간대를 한국으로 고정 (CI는 UTC — 시험 쪽 Node도 TZ=Asia/Seoul, ci.yml)
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry', timezoneId: 'Asia/Seoul' },
  projects: [
    {
      name: 'Pixel 7',
      use: { ...devices['Pixel 7'], timezoneId: 'Asia/Seoul' },
      testIgnore: /\.prod\.spec\.ts$/,
    },
    // 오프라인·서비스 워커는 배포 빌드에서만 (pnpm build && pnpm preview)
    {
      name: 'prod',
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4173', timezoneId: 'Asia/Seoul' },
      testMatch: /\.prod\.spec\.ts$/,
    },
    // 아이폰(사파리와 같은 WebKit 엔진) — 오프라인·서비스 워커 확인 (사용자 요청 2026-10-28)
    {
      name: 'prod-iphone',
      use: { ...devices['iPhone 13'], baseURL: 'http://localhost:4173', timezoneId: 'Asia/Seoul' },
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
