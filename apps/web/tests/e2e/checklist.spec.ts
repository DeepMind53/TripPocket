import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTrip } from './helpers';

async function drag(page: Page, handle: Locator, target: Locator) {
  const s = await handle.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error('끌 대상이 화면에 없어요');
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2 + 8, { steps: 4 });
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 20 });
  await page.mouse.up();
}

test('준비물: 템플릿 → 그룹 사이 드래그 → 저장 → 새로고침해도 유지', async ({ page }) => {
  await createTrip(page, '준비물 확인 여행');
  await page
    .getByRole('navigation', { name: '여행 메뉴' })
    .getByRole('link', { name: '준비' })
    .click();

  await page.getByRole('button', { name: '템플릿 불러오기·관리' }).click();
  await page.getByRole('button', { name: '휴양지 불러오기' }).click();
  await expect(page.getByText(/개를 넣었어요/)).toBeVisible();

  await page.getByRole('checkbox', { name: '수영복' }).click();
  // 보조배터리(전자기기)를 서류 그룹의 여권 위로 끌어 옮긴다
  await drag(
    page,
    page.getByRole('button', { name: '보조배터리 옮기기' }),
    page.getByRole('checkbox', { name: '여권', exact: true }),
  );
  const docs = page.locator('details', { has: page.getByText('서류', { exact: true }) });
  await expect(docs).toContainText('보조배터리');

  await page
    .getByRole('region', { name: '저장하지 않은 변경' })
    .getByRole('button', { name: '저장' })
    .click();
  await expect(page.getByText('저장했어요')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('checkbox', { name: '수영복' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(
    page.locator('details', { has: page.getByText('서류', { exact: true }) }),
  ).toContainText('보조배터리');
});
