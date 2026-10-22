import { expect, test } from './fixtures';

test('설정: 다크 테마·글자 크기는 새로고침해도 바로 적용, 12시간 표기는 일정에 반영', async ({
  page,
}) => {
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();

  await page.goto('/settings');
  const display = page.getByRole('region', { name: '화면' });
  await display.getByRole('radio', { name: '다크' }).click();
  await display.getByRole('radio', { name: /오전·오후/ }).click();
  await display.getByRole('slider', { name: '글자 크기' }).press('ArrowRight');
  await expect(display.getByText('크게')).toBeVisible();

  await page.reload();
  // index.html이 그리기 전에 적용 (깜빡임 없음)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe('115%');

  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();
  await expect(page.getByText('오전 9:10')).toBeVisible();
});
