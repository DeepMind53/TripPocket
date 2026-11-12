import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

test('백업 파일을 만들고, 데이터를 지운 뒤 그 파일로 복원한다', async ({ page }) => {
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();

  await page.goto('/me');
  await page.getByRole('link', { name: '백업·복원' }).click();
  await expect(page.getByText('마지막 백업: 아직 없음')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '지금 백업 파일 만들기' }).click();
  const file = await (await download).path();
  expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ format: 'trippocket-backup' });
  await expect(page.getByText('마지막 백업: 오늘')).toBeVisible();

  // 데이터 지우기 (개발용 화면)
  await page.goto('/dev/db');
  await page.getByRole('button', { name: /모두 지우기|전체 삭제|초기화/ }).click();

  await page.goto('/backup');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '백업 파일에서 복원' }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByText(/여행 1개/)).toBeVisible();
  await page.getByRole('radio', { name: /전체 바꾸기/ }).click();
  await page.getByRole('button', { name: '지우고 바꾸기' }).click();
  await expect(page.getByText('복원했어요')).toBeVisible();

  await page.goto('/trips');
  await expect(page.getByText('도쿄 가을여행')).toBeVisible();
});

test('백업하면 이 기기에도 한 벌 남아, 파일을 찾지 않고 바로 복원한다 (2026-11-12)', async ({
  page,
}) => {
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/backup');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '지금 백업 파일 만들기' }).click();
  await download;
  const recent = page.getByRole('region', { name: '이 기기의 최근 백업' });
  await expect(recent).toBeVisible();
  // 휴대폰 파일 창에서 찾기 쉽게 마지막 파일 이름
  await expect(
    page.getByText(/마지막 파일 trippocket-backup-\d{4}-\d{2}-\d{2}\.json/),
  ).toBeVisible();

  await page.goto('/dev/db');
  await page.getByRole('button', { name: /모두 지우기|전체 삭제|초기화/ }).click();
  await page.goto('/backup');
  await recent.getByRole('button', { name: /복원/ }).first().click();
  await expect(page.getByText(/여행 1개/)).toBeVisible();
  await page.getByRole('button', { name: '합치기' }).last().click();
  await expect(page.getByText('복원했어요')).toBeVisible();
  await page.goto('/trips');
  await expect(page.getByText('도쿄 가을여행')).toBeVisible();
});
