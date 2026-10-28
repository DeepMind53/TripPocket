import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { dayLabel } from './helpers';

/**
 * 오프라인 우선 확인 (사용자 요청 2026-10-28 — 비행기 모드·서버와 통신이 안 될 때도 앱이 동작해야 한다).
 * 배포 빌드(서비스 워커)로, 갤럭시(Chromium)·아이폰(WebKit) 두 엔진에서 돈다 (playwright.config.ts prod 프로젝트)
 */

/** 서비스 워커가 앱 파일을 다 저장하고 화면을 맡을 때까지 (= 홈 화면에 설치한 상태) */
async function install(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

async function newTrip(page: Page, title: string) {
  await page.goto('/trips/new');
  await page.getByRole('button', { name: /도쿄/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: dayLabel(3), exact: true }).click();
  await page.getByRole('button', { name: dayLabel(5), exact: true }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('여행 이름').fill(title);
  await page.getByRole('button', { name: '여행 만들기' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(title) })).toBeVisible();
  return page
    .url()
    .split('?')[0]!
    .replace(/\/plan$/, '');
}

async function addItem(page: Page, tripUrl: string, name: string) {
  await page.goto(`${tripUrl}/plan?day=1`);
  const day = page.getByRole('region', { name: /^1일차/ });
  await day.getByRole('button', { name: '일정 추가' }).first().click();
  const form = page.getByRole('dialog', { name: '일정 추가' });
  await form.getByLabel('이름').fill(name);
  await form.getByLabel('시작').fill('10:00');
  await form.getByRole('button', { name: '일정에 추가' }).click();
  await expect(form).toBeHidden();
  await expect(page.getByRole('button', { name: new RegExp(`일정, ${name}`) })).toBeVisible();
}

/** 여행의 주요 화면이 다 열리는지 (일정·예약·준비·환율·설정·홈) */
async function visitAll(page: Page, tripUrl: string, title: string) {
  await page.goto('/');
  await expect(page.getByText(title).first()).toBeVisible();
  await page.goto(`${tripUrl}/plan`);
  await expect(page.getByRole('region', { name: /^1일차/ })).toBeVisible();
  await page.goto(`${tripUrl}/bookings`);
  await expect(page.getByRole('button', { name: /예약 추가/ }).first()).toBeVisible();
  await page.goto(`${tripUrl}/checklist`);
  await expect(page.getByRole('radio', { name: '준비물' })).toBeVisible();
  await page.goto('/fx');
  await expect(page.getByRole('heading', { name: '환율 계산기' })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('region', { name: '화면' })).toBeVisible();
}

test('비행기 모드: 설치 후 인터넷 없이 앱을 새로 열어도 모든 화면이 열리고, 일정을 더하고 고친 것이 남는다', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await install(page);
  const trip = await newTrip(page, '비행기 모드 여행');
  await addItem(page, trip, '센소지');

  await context.setOffline(true);
  // 앱을 완전히 새로 연 것처럼 (서비스 워커 저장본으로)
  await page.reload();
  await expect(page.getByText(/오프라인/).first()).toBeVisible();
  await visitAll(page, trip, '비행기 모드 여행');

  // 오프라인에서 일정 추가·다녀옴 표시
  await addItem(page, trip, '스카이트리');
  await page.getByRole('button', { name: /일정, 센소지/ }).click();
  const detail = page.getByRole('dialog', { name: '센소지' });
  await expect(detail).toBeVisible();
  await page.goBack();
  await expect(detail).toBeHidden();

  // 다시 열어도 남아 있다 (기기 DB)
  await page.reload();
  await expect(page.getByRole('button', { name: /일정, 스카이트리/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /일정, 센소지/ })).toBeVisible();
});

test('서버만 끊김(인터넷은 됨, 서버 502): 앱은 그대로 열리고 저장된다', async ({ page }) => {
  test.setTimeout(120_000);
  await install(page);
  const trip = await newTrip(page, '서버 끊김 여행');
  await page.route('**/api/**', (r) => r.fulfill({ status: 502, body: 'Bad Gateway' }));
  await page.route('**/auth/**', (r) => r.fulfill({ status: 502, body: 'Bad Gateway' }));
  await page.reload();
  await visitAll(page, trip, '서버 끊김 여행');
  await addItem(page, trip, '이치란 라멘');
  await page.reload();
  await expect(page.getByRole('button', { name: /일정, 이치란 라멘/ })).toBeVisible();
});

test('서버가 대답하지 않음(요청이 멈춤): 화면이 멈추지 않고 일정을 더할 수 있다', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await install(page);
  const trip = await newTrip(page, '서버 무응답 여행');
  // 응답을 끝내 주지 않는다
  await page.route('**/api/**', () => {});
  await page.reload();
  await visitAll(page, trip, '서버 무응답 여행');
  await addItem(page, trip, '긴자 쇼핑');
});
