import type { Booking } from '@trippocket/shared';
import { Bus, TrainFront } from 'lucide-react';
import { isBusTitle } from '../../domain/travelLeg';
import { BOOKING_ICON } from './bookingKinds';

/** 예약 그림 — 기차·버스 예약은 교통편 이름으로 기차/버스를 나눈다 (사용자 요청 2026-11-03) */
export function BookingKindIcon({
  booking: b,
  className,
}: {
  booking: Pick<Booking, 'kind' | 'title'>;
  className?: string;
}) {
  if (b.kind === 'train')
    return isBusTitle(b.title) ? (
      <Bus aria-hidden="true" className={className} />
    ) : (
      <TrainFront aria-hidden="true" className={className} />
    );
  const Icon = BOOKING_ICON[b.kind];
  return <Icon aria-hidden="true" className={className} />;
}
