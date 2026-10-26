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

test('여행 당일: 오늘 칩이 골라지고 지금 진행 중인 일정이 강조된다', async ({ page }) => {
  await page.clock.install();
  await createTrip(page, '당일 여행');
  const day1 = page.getByRole('region', { name: /^1일차/ });
  for (const [kind, name, time] of [
    ['관광', '센소지', '09:00'],
    ['맛집', '이치란 라멘', '11:30'],
    ['카페', '블루보틀', '14:00'],
    ['쇼핑', '돈키호테', '16:00'],
  ] as const) {
    await day1.getByRole('button', { name: '일정 추가' }).click();
    const form = page.getByRole('dialog', { name: '일정 추가' });
    await form.getByRole('button', { name: kind, exact: true }).click();
    await form.getByLabel('이름').fill(name);
    await form.getByLabel('시작').fill(time);
    await form.getByRole('button', { name: '일정에 추가' }).click();
    await expect(form).toBeHidden();
  }

  // 여행 첫날 도쿄 12:00 — 기기 시간대(CI는 UTC)와 상관없이 여행지 시각으로 맞춘다
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.clock.setFixedTime(new Date(`${ymd}T12:00:00+09:00`));
  await page.goto(page.url().replace(/\?.*$/, ''));

  await expect(page.getByRole('button', { name: /^1일차/, pressed: true })).toBeVisible();
  await expect(page.getByRole('region', { name: /^2일차/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /이치란 라멘/ })).toHaveAttribute(
    'aria-current',
    'time',
  );
  await expect(page.locator('[aria-current="time"]')).toHaveCount(1);
});
