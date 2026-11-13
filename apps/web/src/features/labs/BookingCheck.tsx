import type { Booking, Trip } from '@trippocket/shared';
import { CalendarX } from 'lucide-react';
import { useLab } from '../../data/labsStore';
import { bookingIssues } from '../../domain/tripHints';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { InlineIcon } from '../../shared/ui/InlineIcon';

/**
 * 예약 날짜 점검 (실험실 bookingCheck, 2026-11-13): 예약 탭 위에 — 여행 기간 밖 날짜, 돌아오는 편보다 늦은 체크아웃,
 * 밤 10시 넘은 도착. 날짜를 잘못 넣은 예약을 미리 찾는다
 */
export function BookingCheck({ trip, bookings }: { trip: Trip; bookings: readonly Booking[] }) {
  const { t } = useTranslation();
  const on = useLab('bookingCheck');
  if (!on) return null;
  const issues = bookingIssues(trip, bookings);
  if (!issues.length) return null;
  return (
    <ul aria-label={t('hint.bookingCheck')} className="flex flex-col gap-1">
      {issues.map((x) => (
        <li
          key={`${x.kind}-${x.title}`}
          className="rounded-btn bg-warning/10 px-3 py-2 text-caption whitespace-pre-line text-fg-sub"
        >
          <InlineIcon icon={CalendarX} className="text-warning" />
          {x.kind === 'outside'
            ? t('hint.outside', { title: x.title, date: formatMonthDay(x.date) })
            : x.kind === 'stayAfterFlight'
              ? t('hint.stayAfter', { title: x.title, date: formatMonthDay(x.date) })
              : t('hint.late', { title: x.title, time: x.time })}
        </li>
      ))}
    </ul>
  );
}
