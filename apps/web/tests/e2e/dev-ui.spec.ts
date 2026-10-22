import { expect, test } from './fixtures';

test('컴포넌트 미리보기: 테마 전환과 바텀시트', async ({ page }) => {
  await page.goto('/dev/ui');
  await expect(page.getByRole('heading', { name: '컴포넌트 미리보기' })).toBeVisible();

  await page.getByRole('radio', { name: '다크' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('radio', { name: '시스템' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);

  await page.getByRole('button', { name: '바텀시트 열기' }).click();
  const sheet = page.getByRole('dialog', { name: '일정 추가' });
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});
