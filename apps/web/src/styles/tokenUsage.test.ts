import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 모서리·글자 크기는 토큰만 (docs/31 U6, 2026-11-25): rounded-card·btn·chip·sheet·full, text-micro 등.
 * Tailwind 기본 모서리(2xl·xl·lg·md)와 text-[11px]는 같은 값의 토큰이 있어 쓰지 않는다.
 * 예외: 실험실 샘플·앱 소개 그림(고정 모양), 달력 칸 9px·이모지 크기(text-[20px]~[28px])
 */
const EXEMPT = /FeaturePreview|IntroCarousel/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith('.tsx') && !p.endsWith('.test.tsx') && !EXEMPT.test(p) ? [p] : [];
  });
}

it('토큰 밖 모서리·11px 글자를 쓰지 않는다', () => {
  const bad: string[] = [];
  for (const file of files('src')) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const m = line.match(/\brounded-(2xl|xl|lg|md)\b|text-\[11px\]/);
        if (m) bad.push(`${file}:${i + 1} ${m[0]}`);
      });
  }
  expect(bad).toEqual([]);
});
