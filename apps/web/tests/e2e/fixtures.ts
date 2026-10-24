import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * 모든 e2e 테스트는 외부 서비스(공휴일·날씨)를 실제로 부르지 않는다.
 * 기본은 "정보 없음" 응답. 정보가 필요한 테스트는 page.route로 다시 덮어쓴다 (나중에 건 것이 먼저 적용).
 */
export const test = base.extend<{ offlineApis: void }>({
  offlineApis: [
    async ({ page }, use) => {
      // 앱은 로그인한 사람만 쓴다(AuthGate). e2e는 서버 없이 돌므로 "이 기기에서 로그인한 적 있음"으로 시작
      await page.addInitScript(() => {
        localStorage.setItem('tp-signed-in', '1');
        localStorage.setItem('tp-quick-hint', '1'); // ⚡ 첫 안내 말풍선은 따로 시험
      });
      await page.route('https://date.nager.at/**', (r) => r.fulfill({ json: [] }));
      await page.route('https://api.open-meteo.com/**', (r) =>
        r.fulfill({ json: { daily: { time: [] } } }),
      );
      // jsDelivr: 환율 보조 출처는 고정 값, 대만 공휴일은 정보 없음
      await page.route('https://cdn.jsdelivr.net/**', (r) =>
        r.request().url().includes('currency-api')
          ? r.fulfill({ json: { date: '2026-10-22', krw: { jpy: 0.1, usd: 0.0008, eur: 0.0007 } } })
          : r.fulfill({ status: 404, body: '' }),
      );
      await use();
    },
    { auto: true },
  ],
});
