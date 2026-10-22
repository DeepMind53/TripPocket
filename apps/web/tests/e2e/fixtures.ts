import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * 모든 e2e 테스트는 외부 서비스(공휴일·날씨)를 실제로 부르지 않는다.
 * 기본은 "정보 없음" 응답. 정보가 필요한 테스트는 page.route로 다시 덮어쓴다 (나중에 건 것이 먼저 적용).
 */
export const test = base.extend<{ offlineApis: void }>({
  offlineApis: [
    async ({ page }, use) => {
      await page.route('https://date.nager.at/**', (r) => r.fulfill({ json: [] }));
      await page.route('https://api.open-meteo.com/**', (r) =>
        r.fulfill({ json: { daily: { time: [] } } }),
      );
      await use();
    },
    { auto: true },
  ],
});
