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
  test.setTimeout(180_000);
  for (const n of [1, 2]) {
    // 그날만 보기(날짜 칩)에서 넣는다 — 전체 보기에서 빈 날은 묶여 한 줄로 보인다
    await page
      .getByRole('toolbar', { name: '날짜 선택' })
      .getByRole('button', { name: new RegExp(`^${n}일차 `) })
      .click();
    for (let i = 1; i <= 10; i++) {
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

  // 그날 칸의 맨 위가 화면 위쪽보다 offset만큼 위로 지나가게 스크롤 (스크롤 양이 매번 같도록 숫자로)
  const scrollInto = (n: number, offset: number) =>
    page.evaluate(
      ([day, off]) => {
        const el = [...document.querySelectorAll<HTMLElement>('main section[data-day]')][day - 1]!;
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + off);
      },
      [n, offset] as const,
    );

  // 위쪽 고정 영역(칩 줄·지도/편집 줄) 아래 끝 — 날짜 머리가 붙을 자리
  const pinTop = () =>
    page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('main [data-plan-sticky]')!;
      return bar.getBoundingClientRect().bottom;
    });

  // 1일차 칸 안쪽까지 내리면 1일차 머리가 고정 영역 바로 아래에 붙는다
  await scrollInto(1, 300);
  await expect.poll(async () => Math.abs((await top(1)) - (await pinTop()))).toBeLessThan(2);

  // 2일차 칸 안쪽까지 내리면 2일차 머리가 같은 자리에, 1일차 머리는 위로 지나갔다
  await scrollInto(2, 300);
  await expect.poll(async () => Math.abs((await top(2)) - (await pinTop()))).toBeLessThan(2);
  expect(await top(1)).toBeLessThan(await pinTop());
});
