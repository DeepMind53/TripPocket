import { expect, type Page } from '@playwright/test';

/** 오늘부터 offset일 뒤의 달력 라벨 "10.24 (토)" (브라우저와 같은 기기 시간대) */
export function dayLabel(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}.${day} (${'일월화수목금토'.charAt(d.getDay())})`;
}

export async function createTrip(page: Page, title: string) {
  await page.goto('/trips/new');
  await page.getByRole('button', { name: /도쿄/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: dayLabel(3), exact: true }).click();
  await page.getByRole('button', { name: dayLabel(6), exact: true }).click();
  await expect(page.getByText(/3박 4일/)).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('여행 이름').fill(title);
  await page.getByRole('button', { name: '여행 만들기' }).click();
  await expect(page.getByRole('heading', { name: `🗼 ${title}` })).toBeVisible();
}
