import { expect, test } from './fixtures';
import { createTrip } from './helpers';

test('예약: 숙소를 추가하면 예약 탭 카드와 일정 화면 숙소 띠에 보인다', async ({ page }) => {
  await createTrip(page, '숙소 확인 여행');
  await page
    .getByRole('navigation', { name: '여행 메뉴' })
    .getByRole('link', { name: '예약' })
    .click();

  await page.getByRole('button', { name: '예약 추가' }).click();
  const sheet = page.getByRole('dialog', { name: '예약 추가' });
  await sheet.getByRole('button', { name: '숙소' }).click();
  await sheet.getByLabel('숙소 이름').fill('신주쿠 그레이스리 호텔');
  await sheet.getByLabel('예약번호').fill('HTL-2026');
  await sheet.getByRole('button', { name: '예약 추가' }).click();

  const lodging = page.getByRole('region', { name: '숙소' });
  await expect(lodging).toContainText('신주쿠 그레이스리 호텔');
  await expect(lodging).toContainText('3박');
  await expect(lodging).toContainText('HTL-2026');

  await page
    .getByRole('navigation', { name: '여행 메뉴' })
    .getByRole('link', { name: '일정' })
    .click();
  const day1 = page.getByRole('region', { name: /^1일차/ });
  await expect(
    day1.getByRole('button', { name: /신주쿠 그레이스리 호텔, 1번째 밤 숙소/ }),
  ).toBeVisible();
  // 숙소 띠를 누르면 다른 장소처럼 상세 — 조식·길찾기(이동 방법·지도 앱)가 시트 안에 (사용자 요청 2026-10-26)
  await day1.getByRole('button', { name: /1번째 밤 숙소/ }).click();
  const detail = page.getByRole('dialog', { name: '신주쿠 그레이스리 호텔' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('조식 없음')).toBeVisible();
  await expect(detail.getByRole('region', { name: '길찾기' })).toBeVisible();
});
