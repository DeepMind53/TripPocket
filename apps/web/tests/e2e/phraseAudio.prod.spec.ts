import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * 회화 소리 (2026-11-26 사용자 제보 "갤럭시·아이폰에서 소리로 듣기 소리가 안 난다"):
 * 배포 빌드(서비스 워커 포함)에서 실제 버튼을 눌러 소리가 재생되는지 — 갤럭시(Chromium)·아이폰(WebKit) 두 엔진.
 * 중국어 학습 앱처럼 [받기]로 기기에 받아 두고, 같은 주소로 튼다(서비스 워커가 저장본으로) — 인터넷이 없어도
 */

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

/** 재생을 기록한다: 어떤 소리를 틀었는지, 재생이 시작됐는지 */
async function recordPlays(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { plays: { src: string; ok?: boolean; err?: string }[] };
    w.plays = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const rec: { src: string; ok?: boolean; err?: string } = { src: this.src };
      w.plays.push(rec);
      const p = play.call(this);
      p.then(
        () => (rec.ok = true),
        (e: Error) => (rec.err = `${e.name}: ${e.message}`),
      );
      return p;
    };
  });
}

const plays = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { plays: { src: string; ok?: boolean; err?: string }[] }).plays,
  );

test('소리 받기 → 소리로 듣기: 받아 둔 소리를 틀고, 비행기 모드에서도 기기에서 튼다', async ({
  page,
  context,
  browserName,
}) => {
  // 윈도용 시험 WebKit은 어떤 소리(WAV 포함)도 틀지 못한다(NotSupportedError) — 실제 아이폰은 여기서 확인할 수 없다
  test.skip(browserName === 'webkit', '시험용 WebKit(윈도)은 소리 재생을 지원하지 않음');
  await recordPlays(page);
  await install(page);
  await page.goto('/phrases');
  await page.getByRole('radio', { name: '일본어' }).click();
  // 중국어 학습 앱처럼: [받기] → 받는 중 → 받음
  const row = page.locator('[data-phrase-audio]');
  await expect(row).toContainText(/일본어 소리 20개/);
  await row.getByRole('button', { name: '받기' }).click();
  await expect(row).toHaveText('일본어 소리 받음');
  await page.getByRole('button', { name: /감사합니다/ }).click();
  await page.getByRole('button', { name: '소리로 듣기' }).click();
  await expect
    .poll(async () => (await plays(page)).at(-1)?.ok ?? (await plays(page)).at(-1)?.err)
    .toBe(true);
  expect((await plays(page)).at(-1)?.src).toMatch(/\/phrases\/ja-[0-9a-f]{8}\.mp3$/);

  // 인터넷이 끊겨도: 화면을 새로 열고 같은 문장을 다시 들어도 기기 저장소에서
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('radio', { name: '일본어' }).click();
  await page.getByRole('button', { name: /감사합니다/ }).click();
  await page.getByRole('button', { name: '소리로 듣기' }).click();
  await expect
    .poll(async () => (await plays(page)).at(-1)?.ok ?? (await plays(page)).at(-1)?.err)
    .toBe(true);
  await context.setOffline(false);
});

test('받기 전에 소리로 듣기: 누른 그 순간 바로 틀고, 뒤에서 그 말 소리를 받아 [받기] 줄이 받음으로 바뀐다', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', '시험용 WebKit(윈도)은 소리 재생을 지원하지 않음');
  await recordPlays(page);
  await install(page);
  await page.goto('/phrases');
  await page.getByRole('radio', { name: '프랑스어' }).click();
  const row = page.locator('[data-phrase-audio]');
  await expect(row).toContainText(/프랑스어 소리 20개/);
  await page.getByRole('button', { name: /감사합니다/ }).click();
  await page.getByRole('button', { name: '소리로 듣기' }).click();
  await expect
    .poll(async () => (await plays(page)).at(-1)?.ok ?? (await plays(page)).at(-1)?.err)
    .toBe(true);
  expect((await plays(page)).at(-1)?.src).toMatch(/\/phrases\/fr-[0-9a-f]{8}\.mp3$/);
  await page.keyboard.press('Escape');
  await expect(row).toHaveText('프랑스어 소리 받음');
});

test('소리 받기만: [받기] → 받음 → 기기 저장소에 20개 — 아이폰 엔진에서도 (재생은 빼고)', async ({
  page,
}) => {
  await install(page);
  await page.goto('/phrases');
  await page.getByRole('radio', { name: '스페인어' }).click();
  const row = page.locator('[data-phrase-audio]');
  await row.getByRole('button', { name: '받기' }).click();
  await expect(row).toHaveText('스페인어 소리 받음', { timeout: 30_000 });
  const saved = await page.evaluate(async () =>
    (await (await caches.open('tp-phrases')).keys()).filter((r) => r.url.includes('/phrases/es-')),
  );
  expect(saved).toHaveLength(20);
});

test('소리를 못 틀면 큰 글씨 화면 위로 안내가 보인다 — 아무 반응 없이 끝나지 않게 (갤럭시 제보 2026-11-26)', async ({
  page,
  context,
}) => {
  await install(page);
  // 소리 파일도, 기기 읽기 기능도 없는 기기 (서비스 워커 요청도 막으려고 context에)
  await context.route('**/phrases/*.mp3', (r) => r.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined });
  });
  await page.goto('/phrases');
  await page.getByRole('radio', { name: '독일어' }).click();
  await page.getByRole('button', { name: /감사합니다/ }).click();
  await page.getByRole('button', { name: '소리로 듣기' }).click();
  const note = page.getByText(/목소리가 없어요/);
  await expect(note).toBeVisible();
  // 다른 것에 가려져 있으면 눌리지 않는다 (큰 글씨 화면 위에 있는지)
  await note.click({ trial: true });
});
