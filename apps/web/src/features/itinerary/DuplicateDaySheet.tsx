import { getTripDays, type ItineraryItem, type LocalDate, type Trip } from '@trippocket/shared';
import { useState } from 'react';
import { useTrips } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { canEditTrip } from '../../data/tripRoles';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BottomSheet, toast } from '../../shared/ui';
import { dayColor } from './itemKinds';

/**
 * 실험실 "하루 일정 복제" (사용자 요청 2026-10-26): 날짜 메뉴에서 그날 일정을 다른 날·다른 여행으로.
 * 고칠 수 있는 여행만 고를 수 있고, 고른 날의 맨 뒤에 붙는다
 */
export function DuplicateDaySheet({
  open,
  onOpenChange,
  trip,
  from,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  /** 복제할 날 (가고 싶은 곳이면 null) */
  from: LocalDate | null;
  items: readonly ItineraryItem[];
}) {
  const { t } = useTranslation();
  const trips = (useTrips() ?? []).filter((tr) => canEditTrip(tr.id));
  const [targetId, setTargetId] = useState(trip.id);
  const target = trips.find((tr) => tr.id === targetId) ?? trip;
  const days = getTripDays(target.startDate, target.endDate);

  async function pick(date: LocalDate) {
    const n = await itemRepo.duplicate(items, target.id, date);
    onOpenChange(false);
    toast(t('duplicate.done', { n }));
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('duplicate.title')}>
      <div className="flex flex-col gap-3">
        {trips.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-caption font-semibold text-fg-sub">{t('duplicate.trip')}</span>
            <select
              value={target.id}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-11 rounded-btn border border-line bg-surface px-3 text-body-2"
            >
              {trips.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {`${tr.cover.emoji ?? ''} ${tr.title}`.trim()}
                </option>
              ))}
            </select>
          </label>
        )}
        <ul className="flex flex-col divide-y divide-line">
          {days.map((d, i) => {
            const same = target.id === trip.id && d === from;
            return (
              <li key={d}>
                <button
                  type="button"
                  disabled={same}
                  onClick={() => void pick(d)}
                  className="flex min-h-12 w-full items-center gap-3 px-1 text-left disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ background: dayColor(i) }}
                  />
                  <span className="tabular flex-1 text-body-2 font-medium">
                    {t('plan.dayHeader', { n: i + 1, date: formatMonthDay(d) })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </BottomSheet>
  );
}
