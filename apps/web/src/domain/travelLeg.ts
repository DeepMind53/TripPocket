import type { Booking, LocalDate, LocalTime } from '@trippocket/shared';

/**
 * 빠른 메뉴 "지금 필요한 이동 정보" (사용자 요청 2026-11-02, 2026-11-03 기차·버스 포함):
 * 비행기·기차·버스·렌터카를 출발 순서대로 보고, 아직 끝나지 않은(도착·반납 전) 첫 이동을 보여 준다.
 * - 렌터카를 빌린 동안에는 렌터카. 단 그날 떠나는 비행기·기차·버스가 있으면 그것 먼저
 * - 첫 비행기 = 출국편, 마지막 비행기 = 귀국편
 * 시각은 여행지 기준 "YYYY-MM-DD HH:mm" 문자열로 비교 (시각이 없으면 그날 끝으로 본다)
 */
export type LegKind = 'outbound' | 'return' | 'flight' | 'train' | 'bus' | 'car';
export type TravelLeg = { kind: LegKind; booking: Booking } | null;

const at = (date: LocalDate, time?: string) => `${date} ${time ?? '23:59'}`;
const startAt = (b: Booking) => at(b.start.date, b.start.time);
/** 도착(비행기·기차·버스) 또는 반납(렌터카) */
const endAt = (b: Booking) =>
  b.kind === 'car'
    ? at(b.end?.date ?? b.start.date, b.end?.time)
    : at(b.end?.date ?? b.start.date, b.end?.time ?? b.start.time);

/** 기차·버스 예약 중 버스 (교통편 이름으로) */
export const isBusTitle = (title: string) =>
  /버스|bus|셔틀|shuttle|트롤리|송태우|지프니/i.test(title);

/** 지금부터 끝나지 않은 이동을 순서대로 (첫째 = 지금 보여 줄 것, 둘째 = 다음 이동) */
export function travelLegsAhead(
  bookings: readonly Booking[],
  today: LocalDate,
  now: LocalTime,
): NonNullable<TravelLeg>[] {
  const live = bookings
    .filter((b) => !b.deletedAt && (b.kind === 'flight' || b.kind === 'train' || b.kind === 'car'))
    .sort((a, b) => startAt(a).localeCompare(startAt(b)));
  const flights = live.filter((b) => b.kind === 'flight');
  const kindOf = (b: Booking): LegKind =>
    b.kind === 'car'
      ? 'car'
      : b.kind === 'train'
        ? isBusTitle(b.title)
          ? 'bus'
          : 'train'
        : b === flights[0]
          ? 'outbound'
          : flights.length > 1 && b === flights[flights.length - 1]
            ? 'return'
            : 'flight';
  const cur = `${today} ${now}`;
  const ahead = live.filter((b) => cur < endAt(b));
  const activeCar = ahead.find((b) => b.kind === 'car' && startAt(b) <= cur);
  let order = ahead;
  if (activeCar) {
    // 렌터카를 빌린 동안: 오늘 떠나는 다른 이동이 있으면 그것, 없으면 렌터카가 먼저
    const todayMove = ahead.find((b) => b.kind !== 'car' && b.start.date === today);
    const first = todayMove ?? activeCar;
    order = [first, ...ahead.filter((b) => b !== first)];
  }
  return order.map((b) => ({ kind: kindOf(b), booking: b }));
}
