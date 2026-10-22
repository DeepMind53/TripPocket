import { expect, test } from '@playwright/test';

test('시작 화면이 열린다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('트립포켓');
  await expect(page.getByRole('heading', { name: '트립포켓' })).toBeVisible();
});
