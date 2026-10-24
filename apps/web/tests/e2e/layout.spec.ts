import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * 레이아웃 안정성 (사용자 요청 2026-10-22):
 * - 휴대폰 폭에서 가로로 넘치는 화면이 없어야 한다
 * - 같은 버튼은 화면 전환·입력 중에도 위치가 바뀌지 않아야 한다
 */

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('요소가 화면에 없어요');
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    w: Math.round(b.width),
    h: Math.round(b.height),
  };
}

async function noHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${label}: 가로로 넘침`).toBeLessThanOrEqual(clientWidth);
}

async function seedTrip(page: Page) {
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();
  await expect(page).toHaveURL(/\/plan/);
  return page.url().replace(/\/plan.*$/, '');
}

for (const width of [320, 360, 412]) {
  test(`${width}px: 주요 화면에 가로 넘침이 없다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 760 });
    const trip = await seedTrip(page);
    const pages = [
      '/',
      '/trips',
      '/saved',
      '/me',
      '/settings',
      '/trips/new',
      `${trip}/plan`,
      `${trip}/places`,
      `${trip}/bookings`,
      `${trip}/checklist`,
      `${trip}/settings`,
    ];
    for (const path of pages) {
      await page.goto(path.startsWith('http') ? path : path);
      await page.waitForLoadState('networkidle');
      await noHorizontalOverflow(page, path);
    }
  });
}

test('⚡ 버튼과 하단 탭은 탭을 바꿔도 같은 자리에 있다', async ({ page }) => {
  const trip = await seedTrip(page);

  const appTabs = ['/', '/trips', '/saved', '/me'];
  const quick = page.getByRole('button', { name: '빠른 메뉴' });
  const nav = page.getByRole('navigation', { name: '주요 메뉴' });
  await page.goto(appTabs[0] as string);
  const quickRef = await box(quick);
  const navRef = await box(nav);
  for (const path of appTabs.slice(1)) {
    await page.goto(path);
    expect(await box(quick), `${path} ⚡ 위치`).toEqual(quickRef);
    expect(await box(nav), `${path} 하단 탭 위치`).toEqual(navRef);
  }

  const tripTabs = ['plan', 'places', 'bookings', 'checklist'];
  const tripNav = page.getByRole('navigation', { name: '여행 메뉴' });
  await page.goto(`${trip}/plan`);
  const tQuick = await box(quick);
  const tNav = await box(tripNav);
  const tMore = await box(page.getByRole('button', { name: '더보기' }));
  for (const tab of tripTabs.slice(1)) {
    await tripNav
      .getByRole('link', {
        name: { places: '장소', bookings: '예약', checklist: '준비' }[tab] as string,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${tab}$`));
    expect(await box(quick), `${tab} ⚡ 위치`).toEqual(tQuick);
    expect(await box(tripNav), `${tab} 여행 탭 위치`).toEqual(tNav);
    expect(await box(page.getByRole('button', { name: '더보기' })), `${tab} ⋯ 위치`).toEqual(tMore);
  }
});

test('여행 만들기: 도시를 검색해도 검색창·[다음] 버튼이 움직이지 않는다', async ({ page }) => {
  await page.goto('/trips/new');
  const search = page.getByLabel('도시 검색');
  const next = page.getByRole('button', { name: '다음' });
  const searchRef = await box(search);
  const nextRef = await box(next);

  for (const text of ['ㄷ', '도', '도쿄', 'tokyo', 'a', '']) {
    await search.fill(text);
    expect(await box(search), `"${text}" 입력 후 검색창`).toEqual(searchRef);
    expect(await box(next), `"${text}" 입력 후 [다음]`).toEqual(nextRef);
  }
  await search.fill('tokyo');
  await page.getByRole('list', { name: '검색 결과' }).getByRole('button').first().click();
  expect(await box(next), '도시 선택 후 [다음]').toEqual(nextRef);
});

// ⚡ 플로팅 버튼이 내용을 가리지 않는다 (docs/16 A1): 처음 자리는 하단 탭 바로 위,
// 화면 끝까지 스크롤했을 때 버튼 밑에 깔린 누를 수 있는 요소가 없다
test('⚡ 버튼은 하단 탭 위에 있고, 화면 끝에서 누를 것을 가리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const base = await seedTrip(page);
  for (const path of [`${base}/plan?day=all`, `${base}/checklist`, '/me', '/trips']) {
    await page.goto(path);
    const fab = page.getByRole('button', { name: '빠른 메뉴' });
    await expect(fab).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1200); // 스크롤 뒤 원래 크기로
    const hidden = await page.evaluate(() => {
      const f = document.querySelector('button[aria-label="빠른 메뉴"]')!.getBoundingClientRect();
      const tab = document.querySelector('nav')?.getBoundingClientRect();
      const under = [...document.querySelectorAll('main a, main button, main [role="checkbox"]')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.left < f.right &&
            r.right > f.left &&
            r.top < f.bottom &&
            r.bottom > f.top
          );
        })
        .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim());
      return { under, aboveTab: !tab || f.bottom <= tab.top };
    });
    expect(hidden.aboveTab, `${path}: 탭 위`).toBe(true);
    expect(hidden.under, `${path}: 버튼 밑에 깔린 요소`).toEqual([]);
  }
});
