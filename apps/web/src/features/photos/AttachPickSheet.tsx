import { dayNumberOf, type Trip } from '@trippocket/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { itemRepo } from '../../data/repositories/itemRepo';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { BottomSheet, Chip } from '../../shared/ui';

/**
 * 찍은·고른 사진을 붙일 일정 고르기 (사용자 요청 2026-11-13): 날짜 칩 → 그날 일정 목록.
 * 처음엔 오늘(여행 중이 아니면 첫 날), 지금 일정에 [지금] 표시. 누르면 바로 붙인다
 */
export function AttachPickSheet({
  trip,
  today,
  guessId,
  label,
  onPick,
  onClose,
}: {
  trip: Trip;
  today: string;
  guessId: string | null;
  /** 설명 줄 (예: 사진 2장) */
  label: string;
  onPick: (itemId: string, title: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const items = useLiveQuery(() => itemRepo.listByTrip(trip.id), [trip.id]);
  const list = (items ?? []).filter((i) => i.kind !== 'note');
  const dates = [...new Set(list.map((i) => i.date ?? ''))].sort((a, b) =>
    a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? (dates.includes(today) ? today : (dates[0] ?? ''));
  const day = list
    .filter((i) => (i.date ?? '') === date)
    .sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
  const dayName = (d: string) => {
    if (!d) return t('photos.wish');
    const n = dayNumberOf(trip.startDate, trip.endDate, d);
    return n ? t('plan.dayN', { n }) : d.slice(5).replace('-', '/');
  };

  return (
    <BottomSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('photos.attachTo')}
      description={label}
      autoFocusInput={false}
    >
      <div className="flex flex-col gap-3 pb-2">
        {dates.length > 1 && (
          <div
            role="group"
            aria-label={t('photos.moveDate')}
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {dates.map((d) => (
              <Chip key={d || 'wish'} selected={d === date} onClick={() => setPicked(d)}>
                {dayName(d)}
              </Chip>
            ))}
          </div>
        )}
        {items && day.length === 0 ? (
          <p className="text-body-2 whitespace-pre-line text-fg-muted">{t('photos.noItems')}</p>
        ) : (
          <ul aria-label={t('photos.moveItem')} className="flex flex-col divide-y divide-line">
            {day.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => onPick(i.id, i.title)}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 px-1 py-2 text-left active:bg-bg-subtle',
                    i.id === guessId && 'font-semibold',
                  )}
                >
                  <span className="tabular w-11 shrink-0 text-caption text-fg-sub">
                    {i.startTime ?? ''}
                  </span>
                  <span className="min-w-0 flex-1 text-body-1 break-words">{i.title}</span>
                  {i.id === guessId && (
                    <span className="shrink-0 rounded-full bg-primary-weak px-2 py-0.5 text-micro font-semibold text-primary">
                      {t('photos.nowItem')}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}
