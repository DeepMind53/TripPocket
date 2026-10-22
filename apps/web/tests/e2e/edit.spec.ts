import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** 손잡이를 잡고 target 위로 천천히 끌어 놓는다 (dnd-kit 포인터 센서) */
async function drag(page: Page, handle: Locator, target: Locator, offsetY = -4) {
  const s = await handle.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error('끌 대상이 화면에 없어요');
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2 + 8, { steps: 4 });
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2 + offsetY, { steps: 20 });
  await page.mouse.up();
}

test('편집 모드: 끌어서 같은 날 순서 바꾸기, 다른 날로 옮기기', async ({ page }) => {
  // 샘플 여행: 2일차에 센소지 · 이치란 라멘 · 긴자 쇼핑
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();

  await page.getByRole('button', { name: '편집' }).click();
  const day2 = page.getByRole('region', { name: /^2일차/ });
  const row = (title: string) => day2.getByRole('listitem').filter({ hasText: title });

  // 같은 날: 긴자 쇼핑을 맨 위로
  await drag(page, page.getByRole('button', { name: '긴자 쇼핑 옮기기' }), row('센소지'), -10);
  await expect(day2.getByRole('listitem').first()).toContainText('긴자 쇼핑');

  // 다른 날: 이치란 라멘을 1일차로
  const day1 = page.getByRole('region', { name: /^1일차/ });
  await drag(
    page,
    page.getByRole('button', { name: '이치란 라멘 옮기기' }),
    day1.getByRole('list'),
  );
  await expect(day1).toContainText('이치란 라멘');

  // 완료 후 새로고침해도 유지
  await page.getByRole('button', { name: '완료' }).click();
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: /^2일차/ })
      .getByRole('button', { name: '1번째 일정, 긴자 쇼핑' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: /^1일차/ })).toContainText('이치란 라멘');
});
