import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** 선 아이콘 (lucide). 이모지 일러스트 대신 (unslop 아이콘 패스 2026-11-09, docs/11 §12) */
  icon: LucideIcon;
  title: string;
  description?: string;
  /** 다음 행동 버튼 */
  action?: ReactNode;
  /** 개발 중 안내 (예: "5단계에서 만들어요") */
  note?: string;
  /** 화면 전체가 이 안내뿐일 때 h1 (스크린리더가 화면 제목으로 읽음, docs/16 A4) */
  asPageTitle?: boolean;
}

/** 빈 화면은 다음 행동으로 초대한다 (docs/11 §9) */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  note,
  asPageTitle = false,
}: EmptyStateProps) {
  const Title = asPageTitle ? 'h1' : 'p';
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="mb-2 grid size-14 place-items-center rounded-full bg-fg/5 text-fg-muted"
      >
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <Title className="text-title-2 text-balance">{title}</Title>
      {description && <p className="max-w-[30ch] text-body-2 text-fg-sub">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
      {note && (
        <p className="mt-2 rounded-full bg-bg-subtle px-3 py-1 text-caption text-fg-muted">
          {note}
        </p>
      )}
    </div>
  );
}
