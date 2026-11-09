import { cn } from '../lib/cn';

export interface GateProgressProps {
  /** "출발 게이트" 등 */
  title: string;
  done: number;
  total: number;
  /** 아래 한 줄 ("필수 2개 남았어요" / "모두 준비됐어요") */
  note?: string;
  /** note 색: 남은 필수가 있으면 주의, 다 되면 성공 */
  tone?: 'warn' | 'ok' | 'none';
  className?: string;
}

/** 출발 게이트 — 준비 진행 (docs/29 §4.6). 진행 막대는 성공색, 숫자는 고정폭 */
export function GateProgress({
  title,
  done,
  total,
  note,
  tone = 'none',
  className,
}: GateProgressProps) {
  const pct = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-card bg-bg-subtle px-4 py-3', className)}>
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-body-1 font-semibold">{title}</span>
        <span className="tabular text-body-1 font-semibold">
          {done}
          <span className="text-caption font-medium text-fg-muted">/{total}</span>
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(done, total)}
        className="h-2 overflow-hidden rounded-full bg-line"
      >
        <span
          className="block h-full origin-left bg-success transition-transform duration-400 ease-soft motion-reduce:transition-none"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      {note && (
        <p
          className={cn(
            'text-caption',
            tone === 'warn' ? 'text-warning' : tone === 'ok' ? 'text-success' : 'text-fg-sub',
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}
