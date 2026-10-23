import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

test('공유: 일정 이미지를 PNG로 저장, 여행 파일 내보내기', async ({ page }) => {
  // 휴대폰에서는 공유 시트가 뜨지만, 시험에서는 다운로드로 받아 내용을 확인한다
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined });
  });
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();
  await page.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('button', { name: '공유·내보내기' }).click();

  const image = page.waitForEvent('download');
  await page.getByRole('button', { name: '이미지 저장' }).click();
  const png = readFileSync(await (await image).path());
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(10_000);

  const file = page.waitForEvent('download');
  await page.getByRole('button', { name: '파일 내보내기' }).click();
  const json = JSON.parse(readFileSync(await (await file).path(), 'utf8'));
  expect(json.format).toBe('trippocket-backup');
  expect(json.data.trips).toHaveLength(1);
  expect(json.data.items.length).toBeGreaterThan(0);
});
