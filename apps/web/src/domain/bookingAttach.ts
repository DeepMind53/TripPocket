import type { Booking, ItineraryItem } from '@trippocket/shared';

/** 기존 일정에 연결할 수 있는 예약 종류 (2026-11-26 사용자 요청) */
export const ATTACH_KINDS: ReadonlySet<Booking['kind']> = new Set(['tour', 'ticket']);

/** 연결할 수 있는 일정 종류 — 메모·이동·숙소는 빼고 장소 일정만 */
const STOP_KINDS = new Set<ItineraryItem['kind']>([
  'place',
  'activity',
  'food',
  'cafe',
  'shopping',
]);

type Stop = Pick<ItineraryItem, 'id' | 'date' | 'kind' | 'bookingId' | 'order'>;

/**
 * 이 예약을 연결할 수 있는 일정: 장소 일정 중 예약 표시가 없는 것 + 지금 연결된 일정.
 * 예약이 일정표에 따로 만든 칸은 빼고 (그 칸은 연결하면 휴지통으로 간다)
 * 예약 날짜의 일정 먼저, 그다음 날짜 순(가고 싶은 곳은 맨 뒤)
 */
export function attachableStops<T extends Stop>(
  items: readonly T[],
  booking: { date: string; attachedItemId?: string | undefined },
): T[] {
  const day = booking.date;
  return items
    .filter((i) => STOP_KINDS.has(i.kind) && (!i.bookingId || i.id === booking.attachedItemId))
    .sort((a, b) => {
      const ad = a.date === day ? 0 : 1;
      const bd = b.date === day ? 0 : 1;
      if (ad !== bd) return ad - bd;
      if (a.date !== b.date) {
        if (a.date === null) return 1;
        if (b.date === null) return -1;
        return a.date < b.date ? -1 : 1;
      }
      return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
    });
}

/** 일정 상세에서 고를 수 있는 예약: 투어·티켓 중 다른 일정에 연결되지 않은 것 */
export function attachableBookings(bookings: readonly Booking[], itemId: string): Booking[] {
  return bookings.filter(
    (b) =>
      !b.deletedAt &&
      ATTACH_KINDS.has(b.kind) &&
      (!b.attachedItemId || b.attachedItemId === itemId),
  );
}

/** 이 일정이 장소 일정인지 (연결 칸을 보일지) */
export const isAttachableStop = (item: Pick<ItineraryItem, 'kind'>) => STOP_KINDS.has(item.kind);
