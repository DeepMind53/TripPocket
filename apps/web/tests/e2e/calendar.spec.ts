import { expect, test } from './fixtures';
import { createTrip, dayLabel } from './helpers';

/** 오늘부터 offset일 뒤 "YYYY-MM-DD" (브라우저와 같은 기기 시간대) */
function iso(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('여행 날짜 달력에 공휴일·날씨가 보이고 칩으로 끈다', async ({ page }) => {
  await page.route('https://date.nager.at/**', (r) =>
    r.fulfill({
      json: r.request().url().endsWith('/KR')
        ? [3, 4].map((n) => ({
            date: iso(n),
            localName: '추석',
            name: 'Chuseok',
            countryCode: 'KR',
            global: true,
          }))
        : [],
    }),
  );
  await page.route('https://api.open-meteo.com/**', (r) =>
    r.fulfill({
      json: {
        daily: {
          time: [iso(0), iso(1)],
          weather_code: [0, 63],
          temperature_2m_max: [19, 15],
          temperature_2m_min: [12, 9],
        },
      },
    }),
  );

  await page.goto('/trips/new');
  await page.getByRole('button', { name: /도쿄/ }).click();
  await page.getByRole('button', { name: '다음' }).click();

  const chuseok = page.getByRole('button', { name: `${dayLabel(3)} · 추석 (Chuseok)` });
  await expect(chuseok).toBeVisible();
  await expect(page.getByRole('button', { name: `${dayLabel(4)} · 추석 (Chuseok)` })).toBeVisible();
  await expect(page.getByRole('button', { name: `${dayLabel(1)} · 비 9°/15°` })).toBeVisible();
  // 달이 바뀌는 날(10.31–11.01)이면 두 달 칸에 모두 보일 수 있어 첫 번째만
  await expect(page.getByText(`${dayLabel(3)}–${dayLabel(4)}`).first()).toBeVisible();

  // 정보를 꺼도 날짜 칸 위치는 그대로
  const before = await chuseok.boundingBox();
  await page.getByRole('button', { name: /공휴일/ }).click();
  const plain = page.getByRole('button', { name: dayLabel(3), exact: true });
  await expect(plain).toBeVisible();
  expect(await plain.boundingBox()).toEqual(before);

  await page.getByRole('button', { name: /날씨/ }).click();
  await expect(page.getByRole('button', { name: dayLabel(1), exact: true })).toBeVisible();
  // 끈 상태는 기기에 저장된다 (다시 들어와도 꺼져 있음)
  await page.goto('/trips/new');
  await page.getByRole('button', { name: /도쿄/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('button', { name: /공휴일/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: /날씨/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: dayLabel(3), exact: true })).toBeVisible();
});

test('이미 잡힌 다른 여행은 달력에 표시된다 (겹치는 일정 방지)', async ({ page }) => {
  await createTrip(page, '도쿄 가을여행');
  await page.goto('/trips/new');
  await page.getByRole('button', { name: /오사카/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(
    page.getByRole('button', { name: `${dayLabel(4)} · 여행: 도쿄 가을여행` }),
  ).toBeVisible();
  // 여행 이름은 첫날과 매달 1일에 붙는다 — 오늘 날짜에 따라 달을 넘기면 두 곳
  await expect(page.getByText('여행: 도쿄 가을여행').first()).toBeVisible();
});
