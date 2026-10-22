import { expect, test } from '@playwright/test';

test('저장소: 새로고침해도 여행이 남아 있고 삭제·실행 취소가 된다', async ({ page }) => {
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await expect(page.getByText('도쿄 가을여행')).toBeVisible();

  await page.reload();
  await expect(page.getByText('도쿄 가을여행')).toBeVisible();
  await expect(page.getByText('이치란 라멘')).toBeVisible();

  await page.getByRole('button', { name: '여행 삭제' }).click();
  await expect(page.getByText('저장된 여행이 없어요.')).toBeVisible();
  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(page.getByText('도쿄 가을여행')).toBeVisible();
});
