import { type ItineraryItem } from '@trippocket/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from '../../i18n';
import { IconButton } from '../../shared/ui';
import { ItemRow } from './ItemRow';

/** 지도를 크게 볼 때 아래 일정은 한 개씩: 좌우로 넘기거나 ‹ › (넘기면 지도가 그 핀으로) */
export function MapPager({
  list,
  current,
  onChange,
  onOpen,
}: {
  list: { item: ItineraryItem; n: number; color: string; dayIndex: number; day: string }[];
  current: number;
  onChange: (index: number) => void;
  onOpen: (item: ItineraryItem) => void;
}) {
  const { t } = useTranslation();
  const startX = useRef<number | null>(null);
  const entry = list[current];
  if (!entry)
    return <p className="py-6 text-center text-body-2 text-fg-muted">{t('map.pagerEmpty')}</p>;
  const go = (d: number) => onChange(Math.min(list.length - 1, Math.max(0, current + d)));
  return (
    <section
      aria-label={t('map.pagerLabel')}
      className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3"
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = startX.current === null ? 0 : e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center gap-1">
        <IconButton
          label={t('map.prev')}
          icon={<ChevronLeft />}
          disabled={current === 0}
          onClick={() => go(-1)}
        />
        <p className="flex-1 text-center text-caption font-medium text-fg-sub" aria-live="polite">
          {entry.day} ·{' '}
          <span className="tabular">
            {t('map.pagerPos', { n: current + 1, total: list.length })}
          </span>
        </p>
        <IconButton
          label={t('map.next')}
          icon={<ChevronRight />}
          disabled={current >= list.length - 1}
          onClick={() => go(1)}
        />
      </div>
      <ol>
        <ItemRow
          item={entry.item}
          n={entry.n}
          dayIndex={entry.dayIndex}
          now={false}
          onOpen={() => onOpen(entry.item)}
        />
      </ol>
    </section>
  );
}
