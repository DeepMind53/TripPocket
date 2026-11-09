import type { CSSProperties } from 'react';

/**
 * 일차 번호(0부터) → 노선 색 CSS 변수 (8색 순환, docs/29 §3.1).
 * line = 선·테두리, ink = 글자·채움(흰 글자 4.5:1). 다크 값은 tokens.css가 바꾼다
 */
export function routeColor(dayIndex: number): { line: string; ink: string } {
  const n = (((dayIndex % 8) + 8) % 8) + 1;
  return { line: `var(--tp-day-${n})`, ink: `var(--tp-day-${n}-ink)` };
}

/** 노선 부품에 넘기는 style — 안쪽은 var(--route)·var(--route-ink)로 칠한다 */
export function routeStyle(dayIndex: number | null | undefined): CSSProperties {
  if (dayIndex == null)
    return { '--route': 'var(--tp-line)', '--route-ink': 'var(--tp-fg-sub)' } as CSSProperties;
  const c = routeColor(dayIndex);
  return { '--route': c.line, '--route-ink': c.ink } as CSSProperties;
}
