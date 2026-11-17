import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 선택(켜짐) 상태. 지정하면 토글 칩(aria-pressed)으로 동작 */
  selected?: boolean;
  leading?: ReactNode;
  /** sm = 글자에 맞춘 작은 칩(높이 28) — 일정 탭 위 칩 줄 (사용자 요청 2026-11-18). 기본 34 */
  size?: 'md' | 'sm';
}

/** 필터·카테고리·Day 칩. 높이 34, 완전 둥근 모서리 (docs/11 §5) */
export function Chip({
  selected,
  leading,
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border text-caption transition-colors',
        size === 'sm' ? 'h-7 gap-1 px-2.5' : 'h-[34px] gap-1.5 px-3',
        selected
          ? 'border-transparent bg-primary-weak font-semibold text-primary'
          : 'border-line bg-surface text-fg-sub active:bg-bg-subtle',
        className,
      )}
      {...rest}
    >
      {leading}
      {children}
    </button>
  );
}
