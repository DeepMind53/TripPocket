import { useLayoutEffect, useRef, type CSSProperties } from 'react';

/** 양 끝 반원 홈(반지름 8px)을 카드에서 도려내는 마스크 — 두 원을 뺀 나머지만 보인다 */
const hole = (x: string) =>
  `radial-gradient(circle 8px at ${x} calc(var(--perf-y, -20px) + 1px), transparent 7.5px, #000 8px)`;

/**
 * 홈 가장자리 반원 테두리 (사용자 요청 2026-11-10 "테두리는 있어야"): 반지름 9px 원 테두리를 홈 가운데에 얹는다.
 * 안쪽 8px까지는 마스크로 뚫려 있어 테두리는 홈 바로 바깥(8~9px)에만 보이고, 카드 밖 절반은 카드 클립으로 잘린다.
 * 카드 안 맨 앞에 두 개 (왼쪽·오른쪽) 그린다. 마스크는 테두리 상자 기준, 이 원은 안쪽 상자 기준이라 1px(카드 테두리)씩 맞춘다
 */
export const notchArcClass = (side: 'left' | 'right') =>
  `pointer-events-none absolute top-[calc(var(--perf-y,-20px)-9px)] size-[18px] rounded-full border border-line ${side === 'left' ? '-left-[10px]' : '-right-[10px]'}`;

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
