import { addDays, type Booking, type LocalDate } from '@trippocket/shared';

/** 확인 표시: 출발 날짜·시각이 바뀌면 다시 확인해야 한다 */
export const flightSignature = (b: Pick<Booking, 'start'>) =>
  `${b.start.date} ${b.start.time ?? ''}`;

/**
 * 다시 확인해야 할 항공편 (사용자 요청 2026-10-26): 출발 전날부터 출발 날까지, 아직 [확인]을 안 눌렀거나
 * 누른 뒤 출발 날짜·시각이 바뀐 것. today는 여행지 날짜
 */
export function flightsToReconfirm(
  bookings: readonly Booking[],
  today: LocalDate,
  confirmed: Readonly<Record<string, string>>,
): Booking[] {
  return bookings.filter(
    (b) =>
      b.kind === 'flight' &&
      !b.deletedAt &&
      today >= addDays(b.start.date, -1) &&
      today <= b.start.date &&
      confirmed[b.id] !== flightSignature(b),
  );
}
