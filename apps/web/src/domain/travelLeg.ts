import type { Booking, LocalDate, LocalTime } from '@trippocket/shared';

/**
 * 빠른 메뉴 "지금 필요한 이동 정보" (사용자 요청 2026-11-02): 출국 비행기 → 렌터카 → 귀국 비행기.
 * - 출국편이 도착하기 전: 출국편
 * - 도착한 뒤: 렌터카가 있으면 반납 시각 전까지 렌터카, 없거나 반납한 뒤에는 귀국편
 * 시각은 여행지 기준 "YYYY-MM-DD HH:mm" 문자열로 비교 (시각이 없으면 그날 끝으로 본다)
 */
export type TravelLeg = { kind: 'outbound' | 'car' | 'return'; booking: Booking } | null;

const at = (date: LocalDate, time?: string) => `${date} ${time ?? '23:59'}`;

export function travelLegNow(
  bookings: readonly Booking[],
  today: LocalDate,
  now: LocalTime,
): TravelLeg {
  const live = bookings.filter((b) => !b.deletedAt);
  const flights = live
    .filter((b) => b.kind === 'flight')
    .sort((a, b) => at(a.start.date, a.start.time).localeCompare(at(b.start.date, b.start.time)));
  const outbound = flights[0];
  const ret = flights.length > 1 ? flights[flights.length - 1] : undefined;
  const cur = `${today} ${now}`;
  if (outbound) {
    const landed = at(
      outbound.end?.date ?? outbound.start.date,
      outbound.end?.time ?? outbound.start.time,
    );
    if (cur < landed) return { kind: 'outbound', booking: outbound };
  }
  const car = live
    .filter((b) => b.kind === 'car')
    .sort((a, b) => at(a.start.date, a.start.time).localeCompare(at(b.start.date, b.start.time)))
    .find((b) => cur < at(b.end?.date ?? b.start.date, b.end?.time));
  if (car) return { kind: 'car', booking: car };
  if (ret) return { kind: 'return', booking: ret };
  return null;
}
