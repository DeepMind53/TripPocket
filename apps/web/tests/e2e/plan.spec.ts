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

  // 해외 여행은 묻지 않고 Google 지도 길찾기를 새 창으로 (2026-10-27)
  const popup = page.waitForEvent('popup');
  await detail.getByRole('button', { name: '길찾기' }).click();
  const map = await popup;
  expect(map.url()).toMatch(/google\.com\/maps\/dir\/\?api=1&destination=/);
  await map.close();
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: '삭제' }).click();
  // 한 번 더 묻는다 (2026-10-27)
  await page
    .getByRole('dialog', { name: '삭제할까요?' })
    .getByRole('button', { name: '삭제' })
    .click();
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
  // 방문·미방문 버튼: 지금 진행 중인 일정(이치란 라멘)까지, 다음 일정(블루보틀)은 아직 (사용자 요청 2026-11-17)
  await expect(page.getByRole('group', { name: '이치란 라멘 방문 기록' })).toBeVisible();
  await expect(page.getByRole('group', { name: '블루보틀 방문 기록' })).toHaveCount(0);
  // 홈 "여행 중" 카드(여행 모드와 같은 화면)도 같은 규칙
  await page.goto('/');
  await expect(page.getByRole('group', { name: '이치란 라멘 방문 기록' })).toBeVisible();
  await expect(page.getByRole('group', { name: '블루보틀 방문 기록' })).toHaveCount(0);
});

test('날짜·지도 줄을 접고 펴고, 다시 열어도 기억한다', async ({ page }) => {
  await createTrip(page, '접기 여행');
  const chips = page.getByRole('toolbar', { name: '날짜 선택' });
  await expect(chips).toBeVisible();
  await page.getByRole('button', { name: '날짜·지도 줄 접기' }).click();
  await expect(chips).toBeHidden();
  await expect(page.getByRole('button', { name: '편집' })).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('folded.png') });
  await page.reload();
  await expect(page.getByRole('button', { name: '날짜·지도 줄 펴기' }).first()).toBeVisible();
  await expect(chips).toBeHidden();
  await page.getByRole('button', { name: '날짜·지도 줄 펴기' }).first().click();
  await expect(chips).toBeVisible();
});
