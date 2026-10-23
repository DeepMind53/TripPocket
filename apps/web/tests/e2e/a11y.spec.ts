import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * 접근성 기본 점검 (23단계): 화면 읽기 프로그램이 읽을 이름이 없는 버튼·링크·입력이 없는지, id 중복, 언어 표시.
 * (axe 같은 도구 없이 핵심 규칙만 — 새 의존성 없이)
 */
async function audit(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    const name = (el: Element) =>
      (
        el.getAttribute('aria-label') ||
        (el.getAttribute('aria-labelledby') &&
          document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent) ||
        (el as HTMLElement).innerText ||
        el.getAttribute('title') ||
        (el instanceof HTMLInputElement && el.labels?.[0]?.innerText) ||
        el.querySelector('img[alt]')?.getAttribute('alt') ||
        ''
      ).trim();
    for (const el of document.querySelectorAll(
      'button, a[href], [role="button"], [role="radio"], [role="switch"], [role="slider"]',
    ))
      if (!name(el) && !el.closest('[aria-hidden="true"]'))
        problems.push(`이름 없음: ${el.outerHTML.slice(0, 80)}`);
    for (const el of document.querySelectorAll('input:not([type="hidden"]), textarea, select'))
      if (
        !name(el) &&
        !el.getAttribute('placeholder') &&
        !(el as HTMLElement).hidden &&
        !el.classList.contains('hidden')
      )
        problems.push(`라벨 없음: ${el.outerHTML.slice(0, 80)}`);
    for (const img of document.querySelectorAll('img:not([alt])'))
      problems.push(`alt 없음: ${img.outerHTML.slice(0, 80)}`);
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    for (const id of new Set(ids.filter((v, i) => ids.indexOf(v) !== i)))
      problems.push(`id 중복: ${id}`);
    if (document.documentElement.lang !== 'ko') problems.push('html lang이 ko가 아님');
    return problems;
  });
}

test('주요 화면 접근성 기본 점검', async ({ page }) => {
  await page.goto('/dev/db');
  await page.getByRole('button', { name: '샘플 여행 만들기' }).click();
  await expect(page.getByText('샘플 여행을 만들었어요')).toBeVisible();
  await page.goto('/trips');
  await page.getByText('도쿄 가을여행').click();
  const trip = page.url().replace(/\/plan.*$/, '');
  const pages = [
    '/',
    '/trips',
    '/me',
    '/settings',
    '/backup',
    '/fx',
    '/login',
    '/legal/licenses',
    '/trips/new',
    `${trip}/plan`,
    `${trip}/bookings`,
    `${trip}/checklist`,
    `${trip}/settings`,
  ];
  const all: string[] = [];
  for (const path of pages) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    for (const p of await audit(page)) all.push(`${path} — ${p}`);
  }
  expect(all).toEqual([]);
});
