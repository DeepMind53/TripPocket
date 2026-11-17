import { expect, test } from './fixtures';

/**
 * 시트를 연 채 화면이 새로 열려도(휴대폰이 뒤로 간 앱을 다시 그림·새로고침) 같은 대상으로 다시 열린다.
 * 시트 열림과 대상(날짜·일정)을 브라우저 기록에 함께 저장 (2026-11-17 상태 머신 정리)
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();
  await expect(page).toHaveURL(/\/plan/);
});

test('날짜 메뉴: 새로고침해도 그 날의 메뉴', async ({ page }) => {
  await page.getByRole('button', { name: /^2일차.* 메뉴$/ }).click();
  const menu = page.getByRole('dialog', { name: /^2일차.* 메뉴$/ });
  await expect(menu).toBeVisible();
  await page.reload();
  await expect(menu).toBeVisible();
});

test('일정 고치기: 새로고침해도 고치던 일정 그대로', async ({ page }) => {
  await page.getByRole('button', { name: /일정, 센소지/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '편집', exact: true }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByRole('textbox', { name: '이름' })).toHaveValue('센소지');
  await page.reload();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: '이름' })).toHaveValue(
    '센소지',
  );
});

test('일정 추가: 새로고침해도 고른 날에 추가', async ({ page }) => {
  await page
    .getByRole('region', { name: /^2일차/ })
    .getByRole('button', { name: '일정 추가' })
    .click();
  await page.getByRole('dialog').getByRole('textbox', { name: '이름' }).fill('도쿄 타워');
  // 저장 전 새로고침 — 입력값은 사라져도 날짜는 2일차
  await page.reload();
  await page.getByRole('dialog').getByRole('textbox', { name: '이름' }).fill('도쿄 타워');
  await page.getByRole('dialog').getByRole('button', { name: '일정에 추가' }).click();
  await expect(page.getByRole('region', { name: /^2일차/ })).toContainText('도쿄 타워');
});
