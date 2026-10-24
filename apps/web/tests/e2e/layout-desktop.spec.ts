import { type Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { createTrip } from './helpers';

// 실제 PC처럼 스크롤바를 보이게 띄운다 (Playwright 기본값은 스크롤바 숨김이라 화면 밀림을 재현 못 함)
test.use({
  viewport: { width: 1280, height: 720 },
  isMobile: false,
  hasTouch: false,
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
});

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

test('PC 화면: 도시 검색 결과가 길어져도(스크롤바 생김) 검색창이 옆으로 밀리지 않는다', async ({
  page,
}) => {
  await page.goto('/trips/new');
  const search = page.getByLabel('도시 검색');
  const before = await box(search);
  await search.fill('a');
  expect(await box(search)).toEqual(before);
});

test('PC 화면: 내용 길이가 달라도(스크롤바 생김) 화면이 옆으로 밀리지 않는다', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  // 새 창은 공통 준비(fixtures)를 거치지 않으므로 직접 "로그인한 적 있는 기기"로
  await context.addInitScript(() => localStorage.setItem('tp-signed-in', '1'));
  const page = await context.newPage();
  await createTrip(page, '스크롤 확인');
  const tripUrl = page.url();
  // 짧은 화면
  await page.goto('/saved');
  const quickShort = await box(page.getByRole('button', { name: '빠른 메뉴' }));
  // 긴 화면 (템플릿으로 준비물 잔뜩)
  await page.goto(tripUrl.replace(/\/plan.*$/, '/checklist'));
  await page.getByRole('button', { name: '템플릿 불러오기·관리' }).click();
  await page.getByRole('button', { name: '해외 기본 불러오기' }).click();
  await expect(page.getByText(/개를 넣었어요/)).toBeVisible();
  await page
    .getByRole('region', { name: '저장하지 않은 변경' })
    .getByRole('button', { name: '저장' })
    .click();
  await expect(page.getByText('저장했어요')).toBeVisible();
  await page.goto('/me');
  const quickMe = await box(page.getByRole('button', { name: '빠른 메뉴' }));
  expect(quickMe).toEqual(quickShort);
  // 시트가 열려도 뒤 화면이 옆으로 밀리지 않는다
  await page.goto(tripUrl.replace(/\/plan.*$/, '/checklist'));
  const tabsBefore = await box(page.getByRole('navigation', { name: '여행 메뉴' }));
  const quick = page.getByRole('button', { name: '빠른 메뉴' });
  const quickBefore = await box(quick);
  await quick.click();
  await expect(page.getByRole('dialog', { name: '빠른 메뉴' })).toBeVisible();
  // 시트가 열리면 뒤 화면은 접근성 트리에서 숨겨지므로 태그로 찾는다
  expect(await box(page.locator('nav[aria-label="여행 메뉴"]'))).toEqual(tabsBefore);
  await page.keyboard.press('Escape');
  expect(await box(quick)).toEqual(quickBefore);
});
