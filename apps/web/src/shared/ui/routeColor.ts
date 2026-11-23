import type { CSSProperties } from 'react';

/**
 * 일차 번호(0부터) → 노선 색 CSS 변수 (14색 순환 — 15일차부터 1일차 색, 2026-11-23 사용자 요청, docs/29 §3.1).
 * line = 선·테두리, ink = 글자·채움(흰 글자 4.5:1). 다크 값은 tokens.css가 바꾼다
 */
/** 일차 색 수 */
export const DAY_COLORS = 14;

export function routeColor(dayIndex: number): { line: string; ink: string } {
  const n = (((dayIndex % DAY_COLORS) + DAY_COLORS) % DAY_COLORS) + 1;
  return { line: `var(--tp-day-${n})`, ink: `var(--tp-day-${n}-ink)` };
}

/**
 * 흰 바탕에 그리는 그림(지도 핀·도장 이미지)용 노선 색 실제 값 — 테마와 상관없이 라이트 값 (tokens.css와 같게)
 */
export const DAY_LINE_HEX = [
  '#2f6bff',
  '#ff6b4a',
  '#12b5a5',
  '#9b5cff',
  '#f5a524',
  '#c2378f',
  '#3ba55c',
  '#5a6b85',
  '#c39bf0',
  '#9c5b2e',
  '#2b3a8f',
  '#33b5e5',
  '#9aa31a',
  '#8b1e3f',
] as const;
export const DAY_INK_HEX = [
  '#2c64ed',
  '#b84d35',
  '#0c7d72',
  '#854fdb',
  '#956516',
  '#c2378f',
  '#2d7d46',
  '#5a6b85',
  '#9047e3',
  '#9c5b2e',
  '#2b3a8f',
  '#14779c',
  '#6c7312',
  '#8b1e3f',
] as const;
export const dayInkHex = (dayIndex: number) =>
  DAY_INK_HEX[((dayIndex % DAY_COLORS) + DAY_COLORS) % DAY_COLORS]!;

/** 노선 부품에 넘기는 style — 안쪽은 var(--route)·var(--route-ink)로 칠한다 */
export function routeStyle(dayIndex: number | null | undefined): CSSProperties {
  if (dayIndex == null)
    return { '--route': 'var(--tp-line)', '--route-ink': 'var(--tp-fg-sub)' } as CSSProperties;
  const c = routeColor(dayIndex);
  return { '--route': c.line, '--route-ink': c.ink } as CSSProperties;
}
