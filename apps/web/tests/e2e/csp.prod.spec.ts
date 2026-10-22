import { expect, test } from './fixtures';

test('배포 보안 정책(CSP)에 막히는 것 없이 주요 화면이 열린다', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  const res = await page.goto('/');
  expect(res?.headers()['content-security-policy']).toContain("default-src 'self'");
  await expect(page.getByRole('heading', { name: '트립포켓' })).toBeVisible();
  for (const path of ['/trips/new', '/settings', '/backup', '/me']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  // 테마 깜빡임 방지 스크립트(boot.js)도 동작
  await page.goto('/settings');
  await page.getByRole('radio', { name: '다크' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(violations).toEqual([]);
});
