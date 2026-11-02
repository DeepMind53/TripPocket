import type { Booking, Trip } from '@trippocket/shared';
import { useLab } from '../../data/labsStore';
import { nightsWithoutStay } from '../../domain/localInfo';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';

/**
 * 예약 탭 위 안내 — 실험실 "숙소 없는 밤" (2026-11-03): 숙소 예약이 하나라도 있는데 비는 밤이 있으면.
 * 숙소 예약이 아예 없으면(직접 다 정하지 않은 여행) 알리지 않는다
 */
export function BookingNotices({ trip, bookings }: { trip: Trip; bookings: readonly Booking[] }) {
  const { t } = useTranslation();
  const on = useLab('missingStay');
  if (!on || !bookings.some((b) => b.kind === 'lodging' && !b.deletedAt)) return null;
  const nights = nightsWithoutStay(trip, bookings);
  if (!nights.length) return null;
  return (
    <p className="rounded-btn bg-warning/10 px-3 py-2 text-caption whitespace-pre-line text-fg-sub">
      {t('missingStay.text', { dates: nights.map(formatMonthDay).join(', ') })}
    </p>
  );
}
