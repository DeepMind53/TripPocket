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

test('예약: 기차·버스는 날짜|교통편, 출발 시각|출발역, 도착 시각|도착역 세 줄 — 320px에서도 넘치지 않는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await createTrip(page, '기차 여행');
  await page
    .getByRole('navigation', { name: '여행 메뉴' })
    .getByRole('link', { name: '예약' })
    .click();
  await page.getByRole('button', { name: '예약 추가' }).click();
  const sheet = page.getByRole('dialog', { name: '예약 추가' });
  await sheet.getByRole('button', { name: /기차/ }).click();
  await sheet.getByLabel('교통편').fill('KTX');
  await sheet.getByLabel('출발 시각').fill('1332');
  await sheet.getByLabel('출발역').fill('동대구역');
  await sheet.getByLabel('도착 시각').fill('1544');
  await sheet.getByLabel('도착역').fill('수원역');
  const overflow = await sheet.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/train-form-320.png' });
  await sheet.getByRole('button', { name: '예약 추가' }).click();
  // 탑승권 모양 (사용자 결정 2026-11-10): 출발역·도착역 크게, 아래 시각 — 320px에서도 카드가 넘치지 않는다
  const card = page.getByRole('button', { name: /KTX/ });
  for (const s of ['동대구역', '13:32', '수원역', '15:44'])
    await expect(card.getByText(s, { exact: true })).toBeVisible();
  const cardOverflow = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(cardOverflow).toBeLessThanOrEqual(1);
});

test('예약: 입력 시트에서 달력 시트를 열면 달력만 보이고, 뒤로 누르면 입력하던 내용 그대로 돌아온다', async ({
  page,
}) => {
  // 창 위에 또 창이 뜨면 헷갈린다 → 한 번에 하나만 (사용자 요청 2026-11-12)
  await page.setViewportSize({ width: 360, height: 740 });
  await createTrip(page, '겹친 창 여행');
  await page
    .getByRole('navigation', { name: '여행 메뉴' })
    .getByRole('link', { name: '예약' })
    .click();
  await page.getByRole('button', { name: '예약 추가' }).click();
  const form = page.getByRole('dialog', { name: '예약 추가' });
  await form.getByRole('button', { name: '숙소' }).click();
  await form.getByLabel('숙소 이름').fill('신주쿠 그레이스리 호텔');
  await expect(form.getByRole('button', { name: '뒤로' })).toHaveCount(0);

  await form.getByRole('button', { name: /체크인 → 체크아웃/ }).click();
  const stay = page.getByRole('dialog', { name: '체크인 · 체크아웃' });
  await expect(stay).toBeVisible();
  await expect(page.getByLabel('숙소 이름')).toBeHidden();
  // "뒤로"는 손가락으로 누를 만큼 크고(44px), 제목과 왼쪽 줄이 맞는다
  const back = stay.getByRole('button', { name: '뒤로' });
  const box = (await back.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: 'test-results/sheet-stack-inner-360.png' });

  await back.click();
  await expect(stay).toBeHidden();
  await expect(form).toBeVisible();
  await expect(form.getByLabel('숙소 이름')).toHaveValue('신주쿠 그레이스리 호텔');
  await page.screenshot({ path: 'test-results/sheet-stack-outer-360.png' });
});
