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
}

/** 노선 막대 (docs/29 §5·§7.2, 사용자 결정 Q7): 일차 수만큼 노선 색 칸, 오늘 칸 위에 점 */
export function RouteBar({
  days,
  todayIndex = null,
  pastBefore = 0,
  label,
  className,
}: RouteBarProps) {
  const n = Math.max(1, Math.min(days, 30));
  return (
    <div role="img" aria-label={label} className={cn('relative pt-1.5', className)}>
      <div
        className="grid h-1.5 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            className="rounded-[2px]"
            style={{ background: routeColor(i).line, opacity: i < pastBefore ? 0.35 : 1 }}
          />
        ))}
      </div>
      {todayIndex !== null && todayIndex >= 0 && todayIndex < n && (
        <span
          aria-hidden="true"
          className="absolute top-0 size-1.5 -translate-x-1/2 rounded-full bg-fg"
          style={{ left: `${((todayIndex + 0.5) / n) * 100}%` }}
        />
      )}
    </div>
  );
}
