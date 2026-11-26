import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * 회화 소리 (2026-11-26 사용자 제보 "갤럭시·아이폰에서 소리로 듣기 소리가 안 난다"):
 * 배포 빌드(서비스 워커 포함)에서 실제 버튼을 눌러 소리가 재생되는지 — 갤럭시(Chromium)·아이폰(WebKit) 두 엔진.
 * 처음 누르면 한 번 받아 기기에 저장하고 틀고, 그다음엔 인터넷이 없어도 기기에서 바로 튼다
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

test('소리로 듣기: 처음엔 받아 저장하고 틀고, 비행기 모드에서도 기기에서 바로 튼다', async ({
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
  await page.getByRole('button', { name: /감사합니다/ }).click();
  await page.getByRole('button', { name: '소리로 듣기' }).click();
  await expect
    .poll(async () => (await plays(page)).at(-1)?.ok ?? (await plays(page)).at(-1)?.err)
    .toBe(true);
  expect((await plays(page)).at(-1)?.src).toMatch(/^blob:/);

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
