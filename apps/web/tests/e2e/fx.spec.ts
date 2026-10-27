import { expect, test } from './fixtures';

test('빠른 메뉴 → 환율 계산기: 여행 나라 통화로 바로 계산', async ({ page }) => {
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();
  await page.getByRole('button', { name: '빠른 메뉴' }).click();
  await page.getByRole('link', { name: /환율/ }).click();
  await expect(page.getByRole('heading', { name: '환율 계산기' })).toBeVisible();
  await expect(page.getByText('일본 엔 JPY')).toBeVisible();
  await page.getByRole('button', { name: '¥1,000' }).click();
  await expect(page.getByText('₩ 10,000')).toBeVisible();
});
