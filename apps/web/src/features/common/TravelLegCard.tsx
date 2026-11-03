import { Car } from 'lucide-react';
import { Link } from 'react-router';
import type { TravelLeg } from '../../domain/travelLeg';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { FlightTicket, TrainTicket } from '../bookings/BookingCard';

/**
 * 빠른 메뉴 "지금 이동 정보" (사용자 요청 2026-11-02, 2026-11-03 기차·버스 포함): 이동수단을 출발 순서대로,
 * 지금 것 하나를 크게 + 다음 이동 한 줄. 비행기·기차·버스는 누르면 예약 탭의 그 예약으로, 렌터카는 차량번호를 크게
 */
export function TravelLegCard({
  leg,
  next,
  tripId,
  onCar,
}: {
  leg: NonNullable<TravelLeg>;
  /** 그다음 이동 (한 줄로) */
  next?: NonNullable<TravelLeg> | undefined;
  tripId: string;
  onCar: () => void;
}) {
  const { t } = useTranslation();
  const b = leg.booking;
  const label = (
    <span className="text-caption font-bold text-primary">{t(`quickMenu.leg.${leg.kind}`)}</span>
  );
  const nextLine = next && (
    <span className="tabular truncate border-t border-dashed border-line pt-1.5 text-caption text-fg-sub">
      {t('quickMenu.leg.next', {
        what: [
          t(`quickMenu.leg.${next.kind}`),
          next.booking.kind === 'car' ? '' : next.booking.title,
          formatMonthDay(next.booking.start.date),
          next.booking.start.time ?? '',
          next.booking.start.place ?? '',
        ]
          .filter(Boolean)
          .join(' '),
      })}
    </span>
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
        {nextLine}
      </button>
    );
  return (
    <Link
      to={`/trips/${tripId}/bookings?focus=${b.id}`}
      replace
      className="flex flex-col gap-1.5 rounded-card border border-primary/40 bg-primary-weak/40 px-3 py-2.5"
    >
      {label}
      {b.kind === 'train' ? <TrainTicket booking={b} /> : <FlightTicket booking={b} />}
      {nextLine}
    </Link>
  );
}
