import { useLayoutEffect, useRef, type CSSProperties } from 'react';

/** 양 끝 반원 홈(반지름 8px)을 카드에서 도려내는 마스크 — 두 원을 뺀 나머지만 보인다 */
const hole = (x: string) =>
  `radial-gradient(circle 8px at ${x} var(--perf-y, -20px), transparent 7.5px, #000 8px)`;

export const TICKET_NOTCH_STYLE: CSSProperties = {
  WebkitMaskImage: `${hole('0')}, ${hole('100%')}`,
  maskImage: `${hole('0')}, ${hole('100%')}`,
  WebkitMaskComposite: 'source-in',
  maskComposite: 'intersect',
};

/**
 * 탑승권 양 끝 홈 (docs/29 §4.5): 카드를 실제로 도려낸다 — 구멍을 덧그리면 카드 테두리 선이 홈 안에 남는다
 * (사용자 제보 2026-11-10). 홈 높이 = 절취선 위치라 실제 위치를 재서 카드에 --perf-y로 적는다.
 * card는 position: relative여야 한다 (절취선 offsetTop 기준)
 */
export function useTicketNotch<C extends HTMLElement, P extends HTMLElement>() {
  const cardRef = useRef<C | null>(null);
  const perfRef = useRef<P | null>(null);
  useLayoutEffect(() => {
    const card = cardRef.current;
    const perf = perfRef.current;
    if (!card || !perf) return;
    // 절취선이 숨겨져 있으면(아래 내용이 없어 :last-child) 홈도 없앤다 — 카드 밖 위쪽으로 보낸다
    const measure = () =>
      card.style.setProperty(
        '--perf-y',
        perf.offsetParent === null ? '-20px' : `${perf.offsetTop}px`,
      );
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(card);
    return () => ro.disconnect();
  });
  return { cardRef, perfRef };
}
