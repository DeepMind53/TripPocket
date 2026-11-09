import type { Booking, Trip } from '@trippocket/shared';
import type { RecentStay } from '../../data/lodgingRecent';
import { parseAgodaLink } from '../../domain/agodaRoutes';

/**
 * 숙소 최저가 입력 칸의 처음 값 (docs/28 I2): 숙소 예약 → 이름·체크인·체크아웃·인원·아고다 바우처 링크,
 * 없으면 여행 날짜
 */
export function lodgingPriceInitial(
  booking: Pick<Booking, 'title' | 'start' | 'end' | 'details'> | undefined,
  trip: Pick<Trip, 'startDate' | 'endDate'> | null | undefined,
): Partial<RecentStay> {
  if (booking) {
    const voucher = booking.details?.voucherUrl;
    return {
      name: booking.title,
      checkIn: booking.start.date,
      ...(booking.end?.date ? { checkOut: booking.end.date } : {}),
      ...(booking.details?.partySize ? { adults: Math.min(8, booking.details.partySize) } : {}),
      ...(voucher && parseAgodaLink(voucher) ? { agoda: voucher } : {}),
    };
  }
  if (trip && trip.endDate > trip.startDate)
    return { checkIn: trip.startDate, checkOut: trip.endDate };
  return {};
}
