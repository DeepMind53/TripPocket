import { Plane } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { TICKET_NOTCH_STYLE, useTicketNotch } from './useTicketNotch';

export interface TicketEnd {
  /** 공항 코드("ICN") 또는 역 이름 */
  code: string;
  /** 아래 작은 줄 ("09:05 · T2") */
  sub?: ReactNode;
}

export interface TicketCell {
  label: string;
  value: ReactNode;
  /** 예약번호처럼 파랑 고정폭 */
  accent?: boolean;
  /** 눌러서 복사 등 — 있으면 버튼 */
  onClick?: () => void;
  'aria-label'?: string;
}

export interface TicketCardProps {
  /** 맨 위 작은 줄 ("대한항공 KE703 · 11.24 (화)") */
  header?: ReactNode;
  /** 탑승권(항공·기차·버스): 출발·도착. 없으면 안내표 (사용자 결정 Q11) */
  from?: TicketEnd;
  to?: TicketEnd;
  /** 출발·도착 사이 아이콘 (기본 비행기) */
  via?: ReactNode;
  /** 역 이름처럼 긴 글자면 작게 */
  codeSize?: 'code' | 'name';
  /** 안내표 제목 (숙소 이름 등) */
  title?: ReactNode;
  /** 아래 2~3칸 */
  cells: readonly TicketCell[];
  /** 칸 아래 한 줄 (회원번호 등) */
  footer?: ReactNode;
  /** 카드 아래 접히는 부가 정보 */
  children?: ReactNode;
  /** 예전: 반원 구멍 색. 이제 카드를 도려내 바탕색이 저절로 보인다 (호환용) */
  hole?: 'bg' | 'bg-subtle';
  className?: string;
}

/**
 * 탑승권·안내표 (docs/29 §4.5). 출발·도착이 있으면 절취선 + 큰 코드(고정폭),
 * 없으면 같은 칸 구조의 안내표. 버튼·문구는 부르는 쪽이 정한다
 */
export function TicketCard({
  header,
  from,
  to,
  via,
  codeSize = 'code',
  title,
  cells,
  footer,
  children,
  className,
}: TicketCardProps) {
  const pass = !!(from && to);
  const codeClass =
    codeSize === 'code' ? 'font-mono text-code-xl tight:text-title-1' : 'text-title-2';
  // 양 끝 홈은 카드를 도려낸다 (덧그리면 테두리 선이 남음, 2026-11-10)
  const { cardRef, perfRef } = useTicketNotch<HTMLDivElement, HTMLDivElement>();
  return (
    <div
      ref={cardRef}
      style={pass ? TICKET_NOTCH_STYLE : undefined}
      className={cn('relative rounded-card border border-line bg-surface shadow-card', className)}
    >
      <div className="flex flex-col gap-2 px-4 pt-3 pb-3">
        {header && <p className="truncate text-caption text-fg-muted">{header}</p>}
        {pass ? (
          <div className="flex items-end gap-2">
            <span className="flex min-w-0 flex-col">
              <span className={cn(codeClass, 'truncate')}>{from.code}</span>
              {from.sub && <span className="tabular text-caption text-fg-sub">{from.sub}</span>}
            </span>
            <span aria-hidden="true" className="relative mb-3 flex min-w-6 flex-1 items-center">
              <span className="w-full border-t-2 border-dotted border-line" />
              <span className="absolute left-1/2 -translate-x-1/2 bg-surface px-1 text-primary [&>svg]:size-4">
                {via ?? <Plane />}
              </span>
            </span>
            <span className="flex min-w-0 flex-col items-end text-right">
              <span className={cn(codeClass, 'truncate')}>{to.code}</span>
              {to.sub && <span className="tabular text-caption text-fg-sub">{to.sub}</span>}
            </span>
          </div>
        ) : (
          title && <p className="text-title-2 text-pretty">{title}</p>
        )}
      </div>
      {pass ? (
        <div
          ref={perfRef}
          aria-hidden="true"
          className="mx-4 border-t-[1.5px] border-dashed border-line"
        />
      ) : (
        <div aria-hidden="true" className="mx-4 border-t border-line" />
      )}
      {/* 좁은 화면·큰 글자(tight)는 2열 — 예약번호가 중간에서 끊기지 않게 */}
      <dl
        className="grid grid-cols-[repeat(var(--cells),minmax(0,1fr))] gap-2 px-4 pt-2.5 pb-3 tight:grid-cols-2"
        style={{ '--cells': Math.max(1, cells.length) } as CSSProperties}
      >
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col">
            <dt className="truncate text-micro text-fg-muted">{c.label}</dt>
            <dd className="m-0 min-w-0">
              {c.onClick ? (
                <button
                  type="button"
                  aria-label={c['aria-label']}
                  onClick={c.onClick}
                  className={cn(
                    // 칸 값은 잘리지 않고 줄바꿈 ("11.24 15:00" → 두 줄, 좁은 화면·큰 글자, docs/29 §9)
                    '-mx-1 max-w-full rounded-md px-1 text-left font-mono text-body-2 font-medium [overflow-wrap:break-word] active:bg-bg-subtle',
                    c.accent ? 'text-primary' : 'text-fg',
                  )}
                >
                  {c.value}
                </button>
              ) : (
                <span
                  className={cn(
                    'block font-mono text-body-2 font-medium [overflow-wrap:break-word]',
                    c.accent ? 'text-primary' : 'text-fg',
                  )}
                >
                  {c.value}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {footer && <div className="-mt-1 px-4 pb-3 text-caption text-fg-sub">{footer}</div>}
      {children && <div className="border-t border-line">{children}</div>}
    </div>
  );
}
