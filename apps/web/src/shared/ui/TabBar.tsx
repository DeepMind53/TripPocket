import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '../lib/cn';

export interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** 하위 경로에서는 활성 표시하지 않음 (홈 "/" 등) */
  end?: boolean;
}

/** 하단 탭바. 높이 56 + 안전영역 (docs/11 §5) */
export function TabBar({
  items,
  label,
  viewTransition = false,
}: {
  items: readonly TabItem[];
  label: string;
  /** 실험실 I4: 탭을 바꿀 때 짧은 페이드 (View Transitions, 지원 브라우저만) */
  viewTransition?: boolean;
}) {
  return (
    <nav
      aria-label={label}
      className="tp-tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul
        className="mx-auto grid h-14 max-w-[560px]"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map(({ to, label: itemLabel, icon: Icon, end }) => (
          <li key={to} className="contents">
            <NavLink
              to={to}
              end={end ?? false}
              viewTransition={viewTransition}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 text-micro',
                  isActive ? 'font-bold text-primary' : 'font-medium text-fg-muted',
                )
              }
            >
              <Icon aria-hidden="true" className="size-[22px]" strokeWidth={1.8} />
              {itemLabel}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
