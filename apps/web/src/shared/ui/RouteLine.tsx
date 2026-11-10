import { useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { routeStyle } from './routeColor';
import { ROUTE_LINE_CLASS, useRouteLine } from './useRouteLine';

export interface RouteLineProps {
  /** 스크린리더 이름 (예: "2일차 노선") */
  label: string;
  /** 일차 번호(0부터) — 노선 색. null이면 회색 (가고 싶은 곳 등) */
  dayIndex: number | null;
  className?: string;
  /** RouteStop · TransferChip · 그 밖의 li */
  children: ReactNode;
}

/**
 * 하루 일정 노선 (docs/29 §4.1): 첫 역부터 마지막 역까지 선 하나(일차 색), 그 위에 역 점(RouteStop)이 얹힌다.
 * 선 위치는 실제 점 가운데를 재서 맞춘다 (사용자 요청 2026-11-10 — 토막 선이 끊기고 가운데가 어긋남)
 */
export function RouteLine({ label, dayIndex, className, children }: RouteLineProps) {
  const ref = useRef<HTMLOListElement | null>(null);
  useRouteLine(ref);
  return (
    <ol
      ref={ref}
      aria-label={label}
      style={routeStyle(dayIndex)}
      className={cn('flex flex-col', ROUTE_LINE_CLASS, className)}
    >
      {children}
    </ol>
  );
}
