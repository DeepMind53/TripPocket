import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 선택(켜짐) 상태. 지정하면 토글 칩(aria-pressed)으로 동작 */
  selected?: boolean;
  leading?: ReactNode;
}

/** 필터·카테고리·Day 칩. 높이 34, 완전 둥근 모서리 (docs/11 §5) */
export function Chip({
  selected,
  leading,
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
        'inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-caption transition-colors',
        selected
          ? 'border-transparent bg-primary-weak font-bold text-primary'
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
