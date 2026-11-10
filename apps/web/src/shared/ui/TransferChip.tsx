import { Footprints } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface TransferChipProps {
  /** 알약 안 글자 ("850m · 길찾기", "KE703 09:05") */
  children: ReactNode;
  /** 수단 아이콘 (lucide 요소). 기본 걷기 */
  icon?: ReactNode;
  /** 예전: 지난 구간 선 흐림. 이제 RouteLine이 지난 역 점(data-route-past)까지 흐리게 그어 쓰지 않는다 (호환용) */
  past?: boolean;
  /** 누르면 (길찾기 시트 등) */
  onClick?: () => void;
  'aria-label'?: string;
}

/**
 * 역 사이 이동 표시 (docs/29 §4.2) — 노선 선을 이어 그리고 오른쪽에 작은 알약.
 * 값은 지금 있는 정보만 (직선거리·예약 시각). 이동 시간 어림은 넣지 않는다 (Q8)
 */
export function TransferChip({
  children,
  icon,
  onClick,
  'aria-label': ariaLabel,
}: TransferChipProps) {
  const pill = (
    <>
      <span aria-hidden="true" className="[&>svg]:size-3.5">
        {icon ?? <Footprints />}
      </span>
      <span className="tabular truncate">{children}</span>
    </>
  );
  const pillClass =
    'inline-flex min-w-0 max-w-full items-center gap-1 self-center rounded-full bg-bg-subtle px-2.5 py-0.5 text-caption text-fg-sub';
  return (
    <li className="relative grid min-h-8 grid-cols-[24px_minmax(0,1fr)] gap-x-3 pb-2">
      {/* 선은 RouteLine이 하나로 긋는다 — 이 칸은 비워 둔다 */}
      <span aria-hidden="true" />
      {onClick ? (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onClick}
          className={cn(pillClass, 'min-h-8 justify-self-start active:bg-line')}
        >
          {pill}
        </button>
      ) : (
        <span aria-label={ariaLabel} className={cn(pillClass, 'justify-self-start')}>
          {pill}
        </span>
      )}
    </li>
  );
}
