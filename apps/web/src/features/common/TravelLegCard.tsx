import { Car } from 'lucide-react';
import { Link } from 'react-router';
import type { TravelLeg } from '../../domain/travelLeg';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { FlightTicket } from '../bookings/BookingCard';

/**
 * 빠른 메뉴 "지금 이동 정보" (사용자 요청 2026-11-02): 출국 비행기 → 렌터카(반납 전까지) → 귀국 비행기.
 * 비행기는 누르면 예약 탭의 그 예약으로, 렌터카는 누르면 차량번호를 크게
 */
export function TravelLegCard({
  leg,
  tripId,
  onCar,
}: {
  leg: NonNullable<TravelLeg>;
  tripId: string;
  onCar: () => void;
}) {
  const { t } = useTranslation();
  const b = leg.booking;
  const label = (
    <span className="text-caption font-bold text-primary">{t(`quickMenu.leg.${leg.kind}`)}</span>
  );
  if (leg.kind === 'car')
    return (
      <button
        type="button"
        onClick={onCar}
        className="flex w-full flex-col gap-1 rounded-card border border-primary/40 bg-primary-weak/40 px-3 py-2.5 text-left"
      >
        {label}
        <span className="flex items-center gap-2">
          <Car aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="tabular text-title-2 font-bold">{b.details?.plate ?? b.title}</span>
          {b.details?.carModel && (
            <span className="truncate text-caption text-fg-sub">{b.details.carModel}</span>
          )}
        </span>
        {b.end && (
          <span className="tabular text-caption text-fg-sub">
            {t('quickMenu.leg.carReturn', {
              date: formatMonthDay(b.end.date),
              time: b.end.time ?? '',
              place: b.end.place ?? '',
            }).trim()}
          </span>
        )}
      </button>
    );
  return (
    <Link
      to={`/trips/${tripId}/bookings?focus=${b.id}`}
      replace
      className="flex flex-col gap-1.5 rounded-card border border-primary/40 bg-primary-weak/40 px-3 py-2.5"
    >
      {label}
      <FlightTicket booking={b} />
    </Link>
  );
}
