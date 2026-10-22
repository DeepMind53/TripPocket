import { expect, test } from './fixtures';
import { dayLabel } from './helpers';

test('설치 후에는 인터넷 없이도 앱이 열리고 만든 여행이 보인다', async ({ page, context }) => {
  await page.goto('/');
  // 서비스 워커가 앱 파일을 다 저장하고 화면을 맡을 때까지
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await page.goto('/trips/new');
  await page.getByRole('button', { name: /도쿄/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: dayLabel(3), exact: true }).click();
  await page.getByRole('button', { name: dayLabel(5), exact: true }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('여행 이름').fill('오프라인 여행');
  await page.getByRole('button', { name: '여행 만들기' }).click();
  await expect(page.getByRole('heading', { name: /오프라인 여행/ })).toBeVisible();

  await context.setOffline(true);
  await page.goto('/trips');
  await expect(page.getByText('오프라인 여행')).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('region', { name: '화면' })).toBeVisible();
});
