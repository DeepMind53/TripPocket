import type { ItineraryItem, LocalDate } from '@trippocket/shared';
import { Check } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BottomSheet } from '../../shared/ui';
import { dayColor } from './itemKinds';

export interface MoveDaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: LocalDate[];
  items: ItineraryItem[];
  current: LocalDate | null | undefined;
  onPick: (date: LocalDate | null) => void;
}

/** S-31 다른 날로 이동 — 고른 날의 맨 뒤로 옮긴다 (드래그 정렬의 대체 수단, docs/05 §7) */
export function MoveDaySheet({
  open,
  onOpenChange,
  days,
  items,
  current,
  onPick,
}: MoveDaySheetProps) {
  const { t } = useTranslation();
  const count = (d: LocalDate | null) => items.filter((i) => i.date === d).length;
  const options: Array<{ date: LocalDate | null; label: string; color: string }> = [
    ...days.map((d, i) => ({
      date: d,
      label: t('plan.dayHeader', { n: i + 1, date: formatMonthDay(d) }),
      color: dayColor(i),
    })),
    { date: null, label: t('plan.wishlist'), color: 'var(--tp-fg-muted)' },
  ];

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('move.title')}>
      <ul className="flex flex-col divide-y divide-line">
        {options.map((o) => {
          const isCurrent = o.date === current;
          return (
            <li key={o.date ?? 'wish'}>
              <button
                type="button"
                disabled={isCurrent}
                onClick={() => onPick(o.date)}
                className="flex min-h-14 w-full items-center gap-3 px-1 text-left disabled:opacity-50"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ background: o.color }}
                />
                <span className="tabular flex-1 text-body-2 font-medium">{o.label}</span>
                <span className="text-caption text-fg-muted">
                  {t('move.count', { n: count(o.date) })}
                </span>
                {isCurrent && <Check aria-hidden="true" className="size-4 text-primary" />}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
