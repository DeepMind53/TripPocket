import { useEffect, useRef } from 'react';
import { cn } from '../lib/cn';
import { routeStyle } from './routeColor';
import { ScrollRow } from './ScrollRow';

export interface DayLineTab<T extends string> {
  value: T;
  label: string;
  /** 날짜 등 작은 글자 ("11.25") */
  sub?: string;
  /** 일차 번호(0부터) — 노선 색. null이면 회색 (전체·가고 싶은 곳) */
  dayIndex: number | null;
  /** 오늘 — 알약 위 작은 점 */
  today?: boolean;
}

export interface DayLineTabsProps<T extends string> {
  /** 스크린리더 이름 */
  label: string;
  items: readonly DayLineTab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * 일차 고르기 (docs/29 §4.3): 노선 색 알약. 선택 = 진한 노선 색 채움 + 흰 글자, 나머지 = 노선 색 테두리.
 * 색만으로 구분하지 않게 일차 글자를 늘 쓴다. 고른 알약은 화면 안으로 스크롤
 */
export function DayLineTabs<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: DayLineTabsProps<T>) {
  const selected = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    selected.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [value]);
  return (
    <ScrollRow
      role="radiogroup"
      aria-label={label}
      className={cn('flex gap-2 pt-1.5 pb-1', className)}
    >
      {items.map((it) => {
        const on = it.value === value;
        const neutral = it.dayIndex === null;
        return (
          <button
            key={it.value}
            ref={on ? selected : undefined}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(it.value)}
            style={routeStyle(it.dayIndex)}
            className={cn(
              'relative inline-flex h-[34px] shrink-0 items-center gap-1 rounded-full border-[1.5px] px-3 text-caption font-semibold whitespace-nowrap transition-colors',
              on
                ? neutral
                  ? 'border-transparent bg-fg text-bg'
                  : 'border-transparent bg-[var(--route-ink)] text-on-primary'
                : neutral
                  ? 'border-line bg-surface text-fg-sub'
                  : 'border-[var(--route)] bg-surface text-[var(--route-ink)]',
            )}
          >
            {it.today && (
              <span
                aria-hidden="true"
                className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-fg"
              />
            )}
            {it.label}
            {it.sub && <span className="tabular font-medium opacity-80">{it.sub}</span>}
          </button>
        );
      })}
    </ScrollRow>
  );
}
