import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../shared/lib/cn';

/** 방문 기록 묶음(여행·도시·장소) — 머리를 누르면 접고 편다 (docs/32 §2) */
export function VisitGroup({
  label,
  title,
  meta,
  sub,
  open,
  onToggle,
  children,
}: {
  /** 스크린리더용 묶음 이름 */
  label: string;
  title: ReactNode;
  /** 오른쪽 숫자 (방문 9/11) */
  meta: string;
  /** 제목 아래 작은 글 (기간·날짜) */
  sub?: string | undefined;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 items-center gap-2 py-2 text-left"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-fg-muted transition-transform',
            !open && '-rotate-90',
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-2 font-semibold">{title}</span>
          {sub && <span className="tabular truncate text-micro text-fg-muted">{sub}</span>}
        </span>
        <span className="tabular shrink-0 text-caption text-fg-sub">{meta}</span>
      </button>
      {open && children}
    </section>
  );
}
