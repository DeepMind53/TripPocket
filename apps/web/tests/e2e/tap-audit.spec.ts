import { expect, test } from './fixtures';

/**
 * 누르기 쉬운 크기 (docs/20 U7): 버튼·링크의 누르는 영역이 가로·세로 모두 40px 미만이면 안 된다
 * (한쪽이라도 넉넉하면 됨 — 글자 링크 등). 주요 화면을 돌며 확인
 */
test('주요 화면의 버튼·링크는 누르기 충분히 크다', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();
  await expect(page).toHaveURL(/\/plan/);
  const trip = page.url().replace(/\/plan.*$/, '');
  const small: string[] = [];
  for (const path of [
    '/',
    '/records',
    '/saved',
    '/me',
    '/settings',
    `${trip}/plan?day=all`,
    `${trip}/places`,
    `${trip}/bookings`,
    `${trip}/checklist`,
    `${trip}/essentials`,
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // 기기 DB 내용이 그려질 때까지
    small.push(
      ...(await page.evaluate(
        (p) =>
          [...document.querySelectorAll('button, a, [role="checkbox"]')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.width < 40 && r.height < 40;
            })
            .map((el) => {
              const r = el.getBoundingClientRect();
              return `${p} ${Math.round(r.width)}x${Math.round(r.height)} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20)}`;
            }),
        path,
      )),
    );
  }
  expect(small).toEqual([]);
});
