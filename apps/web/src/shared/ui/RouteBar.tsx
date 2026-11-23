import { cn } from '../lib/cn';
import { routeColor } from './routeColor';

export interface RouteBarProps {
  /** 여행 일수 (칸 수, 최대 30칸까지 그리고 나머지는 마지막 칸에 합친다) */
  days: number;
  /** 오늘 일차(0부터) — 그 칸 위에 점. 여행 전·후면 null */
  todayIndex?: number | null;
  /** 이 번호보다 앞 칸은 흐리게 (지난 날) */
  pastBefore?: number;
  /** 스크린리더 이름 ("4일 중 2일차") */
  label: string;
  className?: string;
  /** 색 바탕 카드 위(홈 맨 위 여행 카드): 칸은 흰 반투명, 오늘 점은 흰색 (2026-11-23) */
  onColor?: boolean;
  /**
   * onColor에서 여행이 지난 만큼(0~1) — 그만큼 칸을 진한 일차 색으로 채운다 (나머지는 연한 일차 색). 오늘 칸은 여행지 시각만큼만
   * (사용자 요청 2026-11-23: 일정이 지나면 현재 시간 위치까지 채우기). 오늘 점도 그 끝에
   */
  progress?: number;
}

/** 노선 막대 (docs/29 §5·§7.2, 사용자 결정 Q7): 일차 수만큼 노선 색 칸, 오늘 칸 위에 점 */
export function RouteBar({
  days,
  todayIndex = null,
  pastBefore = 0,
  label,
  className,
  onColor = false,
  progress = 0,
}: RouteBarProps) {
  const n = Math.max(1, Math.min(days, 30));
  // 칸 수가 30에 묶이면 진행도도 칸 기준으로
  const filled = Math.min(Math.max(progress, 0), 1) * n;
  return (
    <div role="img" aria-label={label} className={cn('relative pt-1.5', className)}>
      <div
        className={cn(
          'grid h-1.5 gap-[3px]',
          // 색 바탕 카드: 흰 받침 위에 — 표지 색과 일차 색이 같아도 보이게 (사용자 요청 2026-11-23)
          onColor && 'box-content rounded-[4px] bg-white p-[2px]',
        )}
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: n }, (_, i) =>
          onColor ? (
            // 연한 일차 색 칸 위에 지난 만큼 진한 일차 색 (사용자 요청 2026-11-23: 흰색 대신 일차별 색)
            <span
              key={i}
              className="relative overflow-hidden rounded-[2px]"
              style={{ background: `color-mix(in srgb, ${routeColor(i).line} 28%, #fff)` }}
            >
              <span
                data-fill=""
                className="absolute inset-y-0 left-0"
                style={{
                  background: routeColor(i).line,
                  width: `${Math.min(Math.max(filled - i, 0), 1) * 100}%`,
                }}
              />
            </span>
          ) : (
            <span
              key={i}
              className="rounded-[2px]"
              style={{ background: routeColor(i).line, opacity: i < pastBefore ? 0.35 : 1 }}
            />
          ),
        )}
      </div>
      {todayIndex !== null && todayIndex >= 0 && todayIndex < n && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0 size-1.5 -translate-x-1/2 rounded-full',
            onColor ? 'bg-white' : 'bg-fg',
          )}
          style={{
            left: `${(onColor ? filled / n : (todayIndex + 0.5) / n) * 100}%`,
          }}
        />
      )}
    </div>
  );
}
