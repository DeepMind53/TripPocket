import { expect, test, type Page } from '@playwright/test';

/** 오늘부터 offset일 뒤의 달력 라벨 "10.24 (토)" (브라우저와 같은 기기 시간대) */
function dayLabel(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}.${day} (${'일월화수목금토'.charAt(d.getDay())})`;
}

async function createTrip(page: Page, title: string) {
  await page.goto('/trips/new');
  await page.getByRole('button', { name: /도쿄/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: dayLabel(3), exact: true }).click();
  await page.getByRole('button', { name: dayLabel(6), exact: true }).click();
  await expect(page.getByText(/3박 4일/)).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('여행 이름').fill(title);
  await page.getByRole('button', { name: '여행 만들기' }).click();
  await expect(page.getByRole('heading', { name: `🗼 ${title}` })).toBeVisible();
}

test('홈이 열리고 탭으로 이동한다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('트립포켓');
  await expect(page.getByRole('heading', { name: '트립포켓' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: '주요 메뉴' });
  await nav.getByRole('link', { name: '내 여행' }).click();
  await expect(page).toHaveURL(/\/trips$/);
  await nav.getByRole('link', { name: '마이' }).click();
  await expect(page.getByRole('heading', { name: '마이' })).toBeVisible();
});

test('여행을 만들면 목록에 남고, 뒤로가기는 만들기 화면을 건너뛴다', async ({ page }) => {
  await createTrip(page, '도쿄 가을여행');
  await expect(page.getByText(/D-3/)).toBeVisible();

  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/\/trips$/);
  await page.reload();
  await expect(page.getByText('도쿄 가을여행')).toBeVisible();
  await expect(page.getByText('다가오는 여행')).toBeVisible();
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
