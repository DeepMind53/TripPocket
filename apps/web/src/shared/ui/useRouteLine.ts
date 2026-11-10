import { useLayoutEffect, type RefObject } from 'react';

/**
 * 노선 선 한 줄 (사용자 요청 2026-11-10): 첫 역 점 가운데 → 마지막 역 점 가운데까지 선을 하나로 긋고, 점이 그 위를 덮는다.
 * 줄마다 토막을 그리면 이음새가 끊기고 점 가운데와 어긋나서, 실제 점 위치를 재서 목록(ol)에 CSS 변수로 적는다.
 * 점에는 data-route-dot, 지난 역 점에는 data-route-past. 선 모양은 ROUTE_LINE_CLASS
 */
export function useRouteLine(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const dots = [...el.querySelectorAll<HTMLElement>('[data-route-dot]')];
      if (dots.length < 2) {
        el.style.setProperty('--route-h', '0px');
        return;
      }
      const box = el.getBoundingClientRect();
      const center = (d: HTMLElement) => {
        const r = d.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      };
      const first = center(dots[0]!);
      const last = center(dots[dots.length - 1]!);
      const pastDot = [...dots].reverse().find((d) => d.hasAttribute('data-route-past'));
      el.style.setProperty('--route-x', `${first.x}px`);
      el.style.setProperty('--route-top', `${first.y}px`);
      el.style.setProperty('--route-h', `${Math.max(0, last.y - first.y)}px`);
      el.style.setProperty('--route-past', `${pastDot ? center(pastDot).y - first.y : 0}px`);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });
}

/**
 * 목록(ol)에 붙이는 선 모양 — 위치·길이는 useRouteLine이 적는다. 지난 구간(--route-past까지)은 흐리게.
 * 목록 안 점은 relative z-[1] + 바탕색이라 선을 덮는다
 */
export const ROUTE_LINE_CLASS =
  "relative before:pointer-events-none before:absolute before:top-[var(--route-top,0px)] before:left-[var(--route-x,0px)] before:h-[var(--route-h,0px)] before:w-[var(--tp-route-width)] before:-translate-x-1/2 before:rounded-full before:content-[''] before:[background:linear-gradient(to_bottom,color-mix(in_srgb,var(--route)_35%,transparent)_var(--route-past,0px),var(--route)_var(--route-past,0px))]";
