import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { routeStyle } from './routeColor';

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
 * 하루 일정 노선 (docs/29 §4.1): 세로 선(일차 색) 위에 역(RouteStop)과 환승 표시(TransferChip)가 이어진다.
 * 선은 각 줄이 왼쪽 24px 칸에 스스로 그려, 줄 사이에 무엇이 끼어도 끊기지 않는다
 */
export function RouteLine({ label, dayIndex, className, children }: RouteLineProps) {
  return (
    <ol aria-label={label} style={routeStyle(dayIndex)} className={cn('flex flex-col', className)}>
      {children}
    </ol>
  );
}
