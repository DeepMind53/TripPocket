import type { Booking, ItineraryItem, Trip } from '../schema/entities';

/**
 * 로그인 없이 보는 공유 일정 (S-40, docs/06 §4). 기본은 예약번호·연락처·메모·가격 메모를 뺀다 (docs/08 D1)
 */
export interface PublicTrip {
  trip: Omit<Trip, 'memo'>;
  items: ItineraryItem[];
  bookings: Booking[];
  includeSensitive: boolean;
}

export function toPublicTrip(
  trip: Trip,
  items: readonly ItineraryItem[],
  bookings: readonly Booking[],
  includeSensitive: boolean,
): PublicTrip {
  const { memo: _tripMemo, ...publicTrip } = trip;
  const live = <T extends { deletedAt?: string | undefined }>(rows: readonly T[]) =>
    rows.filter((r) => !r.deletedAt);
  return {
    trip: includeSensitive ? trip : publicTrip,
    items: live(items).map((i) => {
      if (includeSensitive) return i;
      const { memo: _m, ...rest } = i;
      return rest;
    }),
    bookings: live(bookings).map((b) => {
      if (includeSensitive) return b;
      const { confirmationNo: _c, memo: _m, priceNote: _p, details, ...rest } = b;
      // 바우처 링크는 예약 확인 토큰이 들어 있을 수 있어 예약번호처럼 뺀다 (2026-10-28)
      const { phone: _ph, voucherUrl: _v, ...publicDetails } = details ?? {};
      return details ? { ...rest, details: publicDetails } : rest;
    }),
    includeSensitive,
  };
}
