import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * 입력 시트 닫힘 보호 (docs/31 A1, 2026-11-23 사용자 결정 §9 Q8 ①: 바뀐 내용이 있을 때만 확인 창)
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();
  await expect(page).toHaveURL(/\/plan/);
});

const openAdd = async (page: Page) => {
  await page
    .getByRole('region', { name: /^2일차/ })
    .getByRole('button', { name: '일정 추가' })
    .click();
  const form = page.getByRole('dialog', { name: '일정 추가' });
  await expect(form).toBeVisible();
  return form;
};

test('입력 없이 바깥을 누르면 바로 닫힌다', async ({ page }) => {
  const form = await openAdd(page);
  await page.mouse.click(180, 40);
  await expect(form).toBeHidden();
  await expect(page.getByText('입력한 내용을 버릴까요?')).toBeHidden();
});

test('이름을 넣고 바깥을 누르면 묻고, [계속 입력]이면 그대로', async ({ page }) => {
  const form = await openAdd(page);
  await form.getByRole('textbox', { name: '이름' }).fill('도쿄 타워');
  await page.mouse.click(180, 40);
  const ask = page.getByRole('dialog', { name: '입력한 내용을 버릴까요?' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: '계속 입력' }).click();
  await expect(ask).toBeHidden();
  await expect(form.getByRole('textbox', { name: '이름' })).toHaveValue('도쿄 타워');
});

test('[취소] → [버리기]면 닫히고 일정은 늘지 않는다', async ({ page }) => {
  const form = await openAdd(page);
  await form.getByRole('textbox', { name: '이름' }).fill('도쿄 타워');
  await form.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '버리기' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText('도쿄 타워')).toBeHidden();
});

test('일정 상세의 [삭제]는 빨간 글자 (docs/31 A2)', async ({ page }) => {
  await page.getByRole('button', { name: /일정, 센소지/ }).click();
  const del = page.getByRole('dialog').getByRole('button', { name: '삭제' });
  const color = await del.evaluate((el) => getComputedStyle(el).color);
  const danger = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--tp-danger').trim(),
  );
  // #d63a31 → rgb(214, 58, 49)
  expect(danger).toBe('#d63a31');
  expect(color).toBe('rgb(214, 58, 49)');
});
