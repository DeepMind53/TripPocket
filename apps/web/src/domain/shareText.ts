import {
  addDays,
  getTripDays,
  type Booking,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';
import { formatMonthDay, formatPeriod } from '../shared/lib/dateFormat';

/**
 * 카톡에 붙여넣기 좋은 일정 요약 (S-25 텍스트로 복사). 예약번호·메모는 넣지 않는다 (docs/08 D1)
 *
 * 🗼 도쿄 가을여행
 * 10.24 (토) – 10.28 (수)
 *
 * [1일차 10.24 (토)]
 * 09:10 인천 → 나리타 KE703
 * ...
 */
export function tripToText(
  trip: Trip,
  items: readonly ItineraryItem[],
  bookings: readonly Booking[],
  time: (t: string | undefined) => string | undefined = (t) => t,
): string {
  const lines = [
    `${trip.cover.emoji ?? ''} ${trip.title}`.trim(),
    formatPeriod(trip.startDate, trip.endDate),
  ];
  const live = items.filter((i) => !i.deletedAt);
  getTripDays(trip.startDate, trip.endDate).forEach((date, i) => {
    const day = live
      .filter((it) => it.date === date)
      .sort((a, b) => (a.order < b.order ? -1 : 1))
      .map((it) => [time(it.startTime), it.title].filter(Boolean).join(' '));
    const lodging = bookings.find(
      (b) =>
        !b.deletedAt &&
        b.kind === 'lodging' &&
        b.start.date <= date &&
        (b.end?.date ?? addDays(b.start.date, 1)) > date,
    );
    if (day.length === 0 && !lodging) return;
    lines.push('', `[${i + 1}일차 ${formatMonthDay(date)}]`, ...day);
    if (lodging) lines.push(`🛏 ${lodging.title}`);
  });
  const wish = live.filter((it) => it.date === null).map((it) => `· ${it.title}`);
  if (wish.length) lines.push('', '[가고 싶은 곳]', ...wish);
  return lines.join('\n');
}
