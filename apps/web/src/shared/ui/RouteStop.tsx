import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type RouteStopState = 'default' | 'past' | 'next';

export interface RouteStopProps {
  /** 역 번호 (점 안). 없으면 정류장이 아닌 줄(메모) — 둥근 네모 점 */
  number?: number | undefined;
  state?: RouteStopState;
  /** 방문 기록: 점 안 번호 대신 체크 / 가로줄 */
  mark?: 'visited' | 'skipped' | null | undefined;
  title: ReactNode;
  /** 제목 아래 한 줄 (종류 · 주소 · "다음 · 38분 뒤") */
  meta?: ReactNode;
  /** 오른쪽 시각 ("14:00", 없으면 "—") */
  time?: string | undefined;
  /** 시각 오른쪽 (방문 표시 버튼 등) */
  trailing?: ReactNode;
  /** 예전: 마지막 역 아래 선 생략. 이제 선은 RouteLine이 첫~마지막 점까지 하나로 그어 쓰지 않는다 (호환용) */
  last?: boolean;
  /** 촘촘히 보기 (설정 compactList) — 점 20·줄 44 */
  dense?: boolean;
  /** 줄 전체를 누르면 (상세 시트 등). 스크린리더 이름은 aria-label */
  onClick?: () => void;
  'aria-label'?: string;
}

/**
 * 노선 위 역 한 줄 (docs/29 §4.1). RouteLine 안에서 쓴다.
 * 지난 역은 점·선·글자가 흐리고, 다음 역은 점을 채우고 바깥 고리 (깜빡이지 않음)
 */
export function RouteStop({
  number,
  state = 'default',
  mark,
  title,
  meta,
  time,
  trailing,
  dense = false,
  onClick,
  'aria-label': ariaLabel,
}: RouteStopProps) {
  const memo = number === undefined;
  const past = state === 'past';
  const next = state === 'next';
  const body = (
    <>
      <span className="flex min-w-0 flex-col justify-center">
        <span
          className={cn(
            // 제목은 두 줄까지 (docs/11 §13-8 긴 글자), 촘촘히 보기는 한 줄
            dense ? 'truncate text-body-1' : 'line-clamp-2 text-body-1 text-pretty',
            past ? 'font-medium text-fg-muted' : 'font-semibold',
            memo && 'font-medium',
          )}
        >
          {title}
        </span>
        {meta && !dense && (
          <span className={cn('truncate text-caption', next ? 'text-primary' : 'text-fg-muted')}>
            {meta}
          </span>
        )}
      </span>
      <span
        className={cn(
          'tabular shrink-0 self-start pt-0.5 text-body-2 font-medium',
          past ? 'text-fg-muted' : 'text-fg',
        )}
      >
        {time ?? (memo ? '' : '—')}
      </span>
    </>
  );
  return (
    <li
      aria-current={next ? 'step' : undefined}
      className={cn(
        'relative grid gap-x-3',
        trailing
          ? 'grid-cols-[24px_minmax(0,1fr)_auto_auto]'
          : 'grid-cols-[24px_minmax(0,1fr)_auto]',
      )}
    >
      {/* 역 점 — 선은 RouteLine이 첫 점~마지막 점까지 하나로 긋고, 점(불투명)이 그 위를 덮는다 */}
      <span aria-hidden="true" className="relative flex justify-center">
        <span
          data-route-dot=""
          {...(past ? { 'data-route-past': '' } : {})}
          className={cn(
            'relative z-[1] mt-0.5 grid place-items-center border-[3px] font-mono text-micro leading-none',
            dense ? 'size-5' : 'size-6',
            memo ? 'rounded-md border-2' : 'rounded-full',
            next
              ? 'border-[var(--route-ink)] bg-[var(--route-ink)] text-on-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--route)_22%,transparent)]'
              : past
                ? 'border-[color-mix(in_srgb,var(--route)_40%,var(--tp-surface))] bg-surface text-fg-muted'
                : 'border-[var(--route)] bg-surface text-[var(--route-ink)]',
          )}
        >
          {mark === 'visited' ? (
            <Check className="size-3" strokeWidth={3} />
          ) : mark === 'skipped' ? (
            <Minus className="size-3" strokeWidth={3} />
          ) : memo ? null : (
            number
          )}
        </span>
      </span>
      {onClick ? (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onClick}
          className={cn(
            'col-span-2 grid grid-cols-subgrid rounded-btn text-left active:bg-bg-subtle',
            dense ? 'min-h-11 pb-2' : 'min-h-14 pb-3',
          )}
        >
          {body}
        </button>
      ) : (
        <div
          aria-label={ariaLabel}
          className={cn(
            'col-span-2 grid grid-cols-subgrid',
            dense ? 'min-h-11 pb-2' : 'min-h-14 pb-3',
          )}
        >
          {body}
        </div>
      )}
      {trailing && <span className="flex items-start pt-0.5">{trailing}</span>}
    </li>
  );
}
