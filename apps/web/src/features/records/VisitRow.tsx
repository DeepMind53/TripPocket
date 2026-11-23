import type { ItineraryItem } from '@trippocket/shared';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { KIND_ICON } from '../itinerary/itemKinds';

/** 방문 기록 한 줄: 종류 아이콘 · 이름(+보조) · 방문/미방문. 누르면 상세 시트 (docs/32 §5) */
export function VisitRow({
  item,
  sub,
  onOpen,
}: {
  item: ItineraryItem;
  /** 이름 아래 작은 글 (도시별: 날짜·여행) */
  sub?: string | undefined;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[item.kind];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left"
      >
        <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-sub" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-2">{item.title}</span>
          {sub && <span className="tabular truncate text-micro text-fg-muted">{sub}</span>}
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold',
            item.visit === 'visited'
              ? 'bg-primary-weak text-primary'
              : 'bg-bg-subtle text-fg-muted',
          )}
        >
          {t(`visit.button.${item.visit ?? 'skipped'}`)}
        </span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
      </button>
    </li>
  );
}
