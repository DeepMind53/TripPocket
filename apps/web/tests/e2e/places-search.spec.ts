import { expect, test } from './fixtures';

const place = (id: string, name: string) => ({ id, name, source: 'osm', address: '도쿄' });

/** 장소 탭: 칩을 빠르게 바꿔 누르면 마지막 검색 결과만 보인다 (늦게 온 이전 결과가 덮어쓰지 않음, 2026-11-17) */
test('장소 검색: 늦게 도착한 이전 결과가 새 결과를 덮어쓰지 않는다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tp-user-id', 'u1'));
  // 서버 흉내: 로그인됨, 나머지 API는 응답 없음(동기화가 화면을 막지 않게)
  await page.route(/^https?:\/\/[^/]+\/api\//, (r) => r.fulfill({ status: 503, body: '' }));
  await page.route(/\/api\/me$/, (r) =>
    r.fulfill({
      json: {
        id: 'u1',
        nickname: '시험',
        createdAt: '2026-11-01',
        providers: [],
        nicknameSet: true,
        isAdmin: true,
      },
    }),
  );
  await page.route(/\/api\/places\/search$/, async (r) => {
    const q = (r.request().postDataJSON() as { q: string }).q;
    if (q.includes('맛집')) {
      // 먼저 누른 칩 — 늦게 도착
      await new Promise((ok) => setTimeout(ok, 1500));
      return r.fulfill({ json: { places: [place('a', '늦은 라멘집')], google: false } });
    }
    return r.fulfill({ json: { places: [place('b', '빠른 카페')], google: false } });
  });

  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();
  await page.getByRole('link', { name: '장소' }).click();

  await page.getByRole('button', { name: '맛집' }).click();
  await page.getByRole('button', { name: '카페' }).click();
  await expect(page.getByText('빠른 카페')).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.getByText('빠른 카페')).toBeVisible();
  await expect(page.getByText('늦은 라멘집')).toBeHidden();
});
