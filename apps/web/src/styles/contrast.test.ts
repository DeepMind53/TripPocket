/// <reference types="node" />
// vitest는 CSS를 비워서 불러오므로(css: false) 파일을 직접 읽는다
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/tokens.css', 'utf8'); // 기준: apps/web;

/**
 * 다크·라이트 모드 글자 대비 (docs/16 I1, WCAG 2.1 대비 공식 — 새 의존성 없이).
 * 본문·보조 글자 4.5:1, 흐린 글자(설명·캡션)·버튼 글자 4.5:1, 크게 쓰는 강조색 3:1
 */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--tp-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]),
  );
}
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

const themes = { light: block(':root {'), dark: block("[data-theme='dark']") };

describe.each(Object.entries(themes))('%s 테마 글자 대비', (_name, c) => {
  it.each([
    ['fg', 'bg', 4.5],
    ['fg-sub', 'bg', 4.5],
    ['fg-sub', 'surface', 4.5],
    ['fg-muted', 'bg', 4.5],
    ['fg-muted', 'surface', 4.5],
    ['fg-muted', 'bg-subtle', 4.5],
    ['on-primary', 'primary', 4.5],
    ['primary', 'bg', 4.5],
    ['primary', 'primary-weak', 4.5],
  ])('%s / %s ≥ %s', (fg, bg, min) => {
    expect(ratio(c[fg]!, c[bg]!)).toBeGreaterThanOrEqual(min);
  });
});

it('다크 모드 두 곳(시스템 설정·직접 선택)의 색이 같다', () => {
  expect(block('prefers-color-scheme: dark')).toEqual(themes.dark);
});
