import { expect, test } from './fixtures';
import { createTrip } from './helpers';

test('홈이 열리고 탭으로 이동한다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('트립포켓');
  await expect(page.getByRole('heading', { name: '트립포켓' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: '주요 메뉴' });
  await nav.getByRole('link', { name: '기록' }).click();
  await expect(page).toHaveURL(/\/records$/);
  await nav.getByRole('link', { name: '마이' }).click();
  await expect(page.getByRole('heading', { name: '마이' })).toBeVisible();
});

test('여행을 만들면 목록에 남고, 뒤로가기는 만들기 화면을 건너뛴다', async ({ page }) => {
  await createTrip(page, '도쿄 가을여행');
  // 여행 화면이 열렸다 (D-day 숫자는 기기·여행지 시간대에 따라 달라 보지 않는다)
  await expect(page.getByRole('heading', { name: /도쿄 가을여행/ })).toBeVisible();

  // 여행 목록은 홈에 (2026-10-24) — 뒤로 가면 홈, 새로고침해도 남아 있다
  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.getByText('도쿄 가을여행')).toBeVisible();
});

test('여행 상세: 탭 이동, 빠른 메뉴는 브라우저 뒤로가기로 닫힌다', async ({ page }) => {
  await createTrip(page, '빠른 메뉴 확인');
  const tripNav = page.getByRole('navigation', { name: '여행 메뉴' });
  await tripNav.getByRole('link', { name: '예약' }).click();
  await expect(page).toHaveURL(/\/bookings$/);

  await page.getByRole('button', { name: '빠른 메뉴' }).click();
  await expect(page.getByRole('dialog', { name: '빠른 메뉴' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: '빠른 메뉴' })).toBeHidden();
  await expect(page).toHaveURL(/\/bookings$/);
});
