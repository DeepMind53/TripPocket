import { expect, test } from './fixtures';
import { createTrip } from './helpers';

test('일정: 추가 → 상세 → 길찾기 → 삭제·실행 취소', async ({ page }) => {
  await createTrip(page, '일정 확인 여행');

  const day1 = page.getByRole('region', { name: /^1일차/ });
  await day1.getByRole('button', { name: '일정 추가' }).click();
  const form = page.getByRole('dialog', { name: '일정 추가' });
  await form.getByRole('button', { name: '맛집' }).click();
  await form.getByLabel('이름').fill('이치란 라멘');
  await form.getByLabel('시작').fill('11:30');
  await form.getByLabel('주소').fill('신주쿠 3-34-11');
  await form.getByRole('button', { name: '일정에 추가' }).click();

  const row = day1.getByRole('button', { name: '1번째 일정, 이치란 라멘' });
  await expect(row).toContainText('11:30');

  // 새로고침해도 남아 있다
  await page.reload();
  await row.click();
  const detail = page.getByRole('dialog', { name: '이치란 라멘' });
  await expect(detail).toContainText('신주쿠 3-34-11');

  await detail.getByRole('button', { name: '길찾기' }).click();
  const dir = page.getByRole('dialog', { name: '이치란 라멘까지' });
  await expect(dir.getByRole('link', { name: 'Google 지도로 열기' })).toHaveAttribute(
    'href',
    /google\.com\/maps\/dir\/\?api=1&destination=/,
  );

  // 뒤로가기: 길찾기 → 상세로
  await page.goBack();
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: '삭제' }).click();
  await expect(row).toBeHidden();
  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(row).toBeVisible();
});
