import {
  diffDays,
  getTripDays,
  nightsBetween,
  todayIn,
  type LocalDate,
  type Trip,
} from '@trippocket/shared';
import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import type { DateRange } from '../../shared/lib/dateRange';
import { BottomSheet, Button, DateRangePicker } from '../../shared/ui';

/**
 * 숙소 체크인·체크아웃을 달력 하나로 (사용자 요청 2026-10-25):
 * 처음 누른 날 = 체크인, 두 번째 = 체크아웃, 그 사이를 이어서 칠한다.
 * 여행 기간은 칸 아래 막대로 따로 보여 고르는 범위와 구별된다
 */
export function StayRangeSheet({
  open,
  onOpenChange,
  trip,
  checkIn,
  checkOut,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
  checkIn: LocalDate;
  checkOut: LocalDate;
  onPick: (checkIn: LocalDate, checkOut: LocalDate) => void;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRange>({ start: checkIn, end: checkOut });
  // 열 때마다 지금 값으로 (렌더 중 맞추기)
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) setRange({ start: checkIn, end: checkOut });
  }
  const tripDays = new Set(getTripDays(trip.startDate, trip.endDate));
  const ok = !!range.start && !!range.end && diffDays(range.start, range.end) >= 1;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('stay.title')}
      description={t('stay.desc')}
      footer={
        <Button
          size="lg"
          fullWidth
          disabled={!ok}
          onClick={() => {
            if (!ok) return;
            onPick(range.start!, range.end!);
            onOpenChange(false);
          }}
        >
          {ok
            ? t('stay.done', {
                from: formatMonthDay(range.start!),
                to: formatMonthDay(range.end!),
                n: nightsBetween(range.start!, range.end!),
              })
            : range.start
              ? t('stay.pickOut')
              : t('stay.pickIn')}
        </Button>
      }
    >
      <p aria-hidden="true" className="mb-3 flex items-center gap-4 text-caption text-fg-sub">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-fg-muted" /> {t('stay.legendTrip')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-primary" /> {t('stay.legendStay')}
        </span>
      </p>
      <DateRangePicker
        value={range}
        // 같은 날을 두 번 누르면(0박) 체크인만 다시 고른 것으로
        onChange={(r) =>
          setRange(r.start && r.end && r.start === r.end ? { start: r.start, end: null } : r)
        }
        today={todayIn(trip.timezone)}
        from={trip.startDate}
        months={3}
        annotate={(d) =>
          tripDays.has(d)
            ? {
                trip: true,
                ...(d === trip.startDate ? { tripTitle: t('stay.tripBar') } : {}),
                description: t('stay.inTrip'),
              }
            : undefined
        }
      />
    </BottomSheet>
  );
}
