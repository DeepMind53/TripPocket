import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** 큰 이모지 (docs/11 §12 — 일러스트는 출시 전 검토) */
  emoji: string;
  title: string;
  description?: string;
  /** 다음 행동 버튼 */
  action?: ReactNode;
  /** 개발 중 안내 (예: "5단계에서 만들어요") */
  note?: string;
}

/** 빈 화면은 다음 행동으로 초대한다 (docs/11 §9) */
export function EmptyState({ emoji, title, description, action, note }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span aria-hidden="true" className="mb-1 text-[44px] leading-none">
        {emoji}
      </span>
      <p className="text-title-2">{title}</p>
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
