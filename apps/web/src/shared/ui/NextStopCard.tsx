import type { ReactNode } from 'react';

export interface NextStopCardProps {
  /** 지역 이름 (스크린리더, 예: "다음 일정") */
  label: string;
  /** 위 작은 줄 ("다음 역 · 지하철 24분") */
  kicker: ReactNode;
  /** 다음 장소 이름 */
  title: ReactNode;
  /** 큰 남은 시간 ("38분") — 없으면 줄을 숨긴다 */
  countdown?: string | null | undefined;
  /** 남은 시간 옆 ("뒤 14:00") */
  countdownSuffix?: ReactNode | undefined;
  /** 지난 역 → 다음 역 진행 (0~1). null이면 막대 없음 */
  progress?: number | null | undefined;
  /** 진행 막대 스크린리더 이름 */
  progressLabel?: string | undefined;
  /** 막대 아래 양 끝 (지난 역 이름, 다음 역 이름) */
  from?: ReactNode | undefined;
  to?: ReactNode | undefined;
  /** 아래 버튼 줄 ([길찾기] [일정 보기]) */
  actions?: ReactNode | undefined;
  /** 여행 모드처럼 더 크게 */
  size?: 'md' | 'lg';
}

/**
 * 다음 역 카드 (docs/29 §4.4, 사용자 결정 Q3 파랑 채움): 홈·여행 모드의 모먼트.
 * 버튼은 actions로 받아 기능·접근 이름을 부르는 쪽이 그대로 정한다
 */
export function NextStopCard({
  label,
  kicker,
  title,
  countdown,
  countdownSuffix,
  progress = null,
  progressLabel,
  from,
  to,
  actions,
  size = 'md',
}: NextStopCardProps) {
  const pct = progress === null ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-1.5 rounded-card bg-primary p-4 text-on-primary"
    >
      <p className="text-caption opacity-85">{kicker}</p>
      <p className={size === 'lg' ? 'text-display text-pretty' : 'text-title-1 text-pretty'}>
        {title}
      </p>
      {countdown && (
        <p className="flex items-baseline gap-1.5">
          <span
            className={
              size === 'lg'
                ? 'tabular text-[3.25rem] leading-none font-semibold tracking-[-0.04em]'
                : 'tabular text-count-xl'
            }
          >
            {countdown}
          </span>
          {countdownSuffix && (
            <span className="tabular text-body-2 opacity-90">{countdownSuffix}</span>
          )}
        </p>
      )}
      {pct !== null && (
        <div className="mt-1 flex flex-col gap-1">
          <div
            role="progressbar"
            aria-label={progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-1.5 overflow-hidden rounded-full bg-on-primary/25"
          >
            <span
              className="block h-full origin-left bg-on-primary transition-transform duration-400 ease-soft motion-reduce:transition-none"
              style={{ transform: `scaleX(${pct / 100})` }}
            />
          </div>
          {(from || to) && (
            <p className="flex justify-between gap-3 text-micro opacity-85">
              <span className="truncate">{from}</span>
              <span className="truncate text-right">{to}</span>
            </p>
          )}
        </div>
      )}
      {actions && <div className="mt-2 flex gap-2">{actions}</div>}
    </section>
  );
}
