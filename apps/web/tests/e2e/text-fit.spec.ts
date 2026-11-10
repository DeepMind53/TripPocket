import { expect, test } from './fixtures';

/**
 * 작은 화면·큰 글씨에서 글자가 단어 중간에서 끊기지 않는다 (사용자 요청 2026-11-02).
 * 10자가 넘는 단어는 칸보다 길 수 있어 뺀다.
 */
const brokenWords = () => {
  const MAX_WORD = 10;
  const out: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('script,style,[aria-hidden="true"]')) continue;
    const css = getComputedStyle(el);
    if (css.visibility === 'hidden' || css.display === 'none') continue;
    for (const m of (n.textContent ?? '').matchAll(/\S+/g)) {
      const word = [...m[0]];
      if (word.length < 2 || word.length > MAX_WORD) continue;
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5);
      const tops = new Set(rects.map((r) => Math.round(r.top / 4)));
      // 글자 크기가 다른 글꼴(국기)은 위치가 조금 달라도 같은 줄이다
      if (tops.size > 1 && rects[rects.length - 1]!.top - rects[0]!.top > rects[0]!.height / 2)
        out.push(m[0]);
    }
  }
  return [...new Set(out)];
};

for (const [width, scale] of [
  [360, 100],
  [320, 100],
  [360, 99],
  [320, 99],
] as const) {
  test(`${width}px·글자 ${scale}%: 단어 중간에서 끊기지 않는다`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height: 760 });
    await page.goto('/dev/db');
    await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
    await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
    await page.goto('/trips');
    await page.getByText('도쿄 가을여행').click();
    await expect(page).toHaveURL(/\/plan/);
    const trip = page.url().replace(/\/plan.*$/, '');
    if (scale === 99) {
      await page.goto('/settings');
      await page.getByRole('slider', { name: '글자 크기' }).focus();
      await page.keyboard.press('End');
      await expect
        .poll(() => page.evaluate(() => document.documentElement.style.fontSize))
        .toBe('99%');
    }
    const found: Record<string, string[]> = {};
    for (const path of [
      '/',
      '/me',
      '/settings',
      '/labs',
      '/backup',
      '/trips/new',
      `${trip}/plan?day=all`,
      `${trip}/places`,
      `${trip}/bookings`,
      `${trip}/checklist`,
      `${trip}/essentials`,
      `${trip}/settings`,
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const words = await page.evaluate(brokenWords);
      if (words.length) found[path.replace(trip, '')] = words;
    }
    expect(found).toEqual({});
  });
}
