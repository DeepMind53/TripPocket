import { expect, test } from './fixtures';
import { createTrip } from './helpers';

/**
 * 날짜 머리(일차·날짜·날씨) 고정 (사용자 요청 2026-10-27): 그날 일정이 보이는 동안 위쪽 고정 영역 바로 아래에 붙고,
 * 다음 날로 넘어가면 다음 날 머리로 바뀐다
 */
test('전체 일정: 1일차를 보는 동안 1일차 머리, 2일차로 내려가면 2일차 머리가 위에 붙는다', async ({
  page,
}) => {
  await createTrip(page, '고정 머리 여행');
  test.setTimeout(120_000);
  for (const n of [1, 2]) {
    // 그날만 보기(날짜 칩)에서 넣는다 — 전체 보기에서 빈 날은 묶여 한 줄로 보인다
    await page
      .getByRole('toolbar', { name: '날짜 선택' })
      .getByRole('button', { name: new RegExp(`^${n}일차 `) })
      .click();
    for (let i = 1; i <= 7; i++) {
      const day = page.getByRole('region', { name: new RegExp(`^${n}일차`) });
      await day.getByRole('button', { name: '일정 추가' }).click();
      const form = page.getByRole('dialog', { name: '일정 추가' });
      await form.getByLabel('이름').fill(`${n}일차 장소 ${i}`);
      await form.getByRole('button', { name: '일정에 추가' }).click();
      await expect(form).toBeHidden();
    }
  }
  await page
    .getByRole('toolbar', { name: '날짜 선택' })
    .getByRole('button', { name: '전체' })
    .click();
  const head = (n: number) =>
    page
      .getByRole('region', { name: new RegExp(`^${n}일차`) })
      .locator('> div')
      .first();
  const top = async (n: number) => (await head(n).boundingBox())!.y;

  // 1일차 일정 중간까지 내리면 1일차 머리는 위에 붙어 있다
  await page.getByRole('button', { name: /1일차 장소 6/ }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 200);
  const pinned = await top(1);
  await page.mouse.wheel(0, 150);
  await expect.poll(() => top(1)).toBeCloseTo(pinned, 0);

  // 2일차 일정으로 내려가면 2일차 머리가 같은 자리에
  await page.getByRole('button', { name: /2일차 장소 5/ }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => top(2)).toBeCloseTo(pinned, 0);
  // 1일차 머리는 화면 위로 지나갔다
  expect(await top(1)).toBeLessThan(pinned);
});
