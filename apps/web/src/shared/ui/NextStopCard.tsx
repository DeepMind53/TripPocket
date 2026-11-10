import type { ReactNode } from 'react';

export interface NextStopCardProps {
  /** 지역 이름 (스크린리더, 예: "다음 일정") */
  label: string;
  /** 위 작은 줄 ("다음 역 · 지하철 24분") */
  kicker: ReactNode;
  /** 다음 장소 이름 */
  title: ReactNode;
  /** 큰 남은 시간 ("38분") — 없으면 줄을 숨긴다 */
  countdown?: ReactNode | null | undefined;
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
  /** 남은 시간 아래 작은 줄 ("(도보 약 30분 또는 대중교통 약 5분)") */
  note?: ReactNode | undefined;
  /** 카드 바탕색 (CSS 색) — 실험실 '다음 역 카드 노선 색'은 그날 노선 진한 색. 없으면 파랑 */
  tone?: string | undefined;
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
  tone,
  note,
}: NextStopCardProps) {
  const pct = progress === null ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <section
      aria-label={label}
      style={tone ? { background: tone } : undefined}
      className="flex flex-col gap-1.5 rounded-card bg-primary p-4 text-on-primary"
    >
      <p className="text-caption opacity-85">{kicker}</p>
      <p className={size === 'lg' ? 'text-display text-pretty' : 'text-title-1 text-pretty'}>
        {title}
      </p>
      {countdown && (
        <div className="flex items-start">
          {/* 큰 남은 시간은 한 줄로 (글자 중간에서 줄이 바뀌지 않게), 옆 글은 모자라면 통째로 다음 줄 (2026-11-10).
              여행 모드는 남은 칸 너비만큼 글자를 키운다 (@container) */}
          <div className="@container flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
              <span
                className={
                  size === 'lg'
                    ? 'tabular text-[min(3.25rem,16cqi)] leading-none font-semibold tracking-[-0.04em] whitespace-nowrap'
                    : 'tabular text-count-xl whitespace-nowrap'
                }
              >
                {countdown}
              </span>
              {countdownSuffix && (
                <span className="tabular text-body-2 whitespace-nowrap opacity-90">
                  {countdownSuffix}
                </span>
              )}
            </p>
            {note && <p className="tabular text-caption text-pretty opacity-90">{note}</p>}
          </div>
        </div>
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
