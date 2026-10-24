import {
  addDays,
  getTripDays,
  type Booking,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';
import { formatMonthDay, formatPeriod } from '../shared/lib/dateFormat';
import { bookingRowsForDay } from './lodging';

/**
 * 카톡에 붙여넣기 좋은 일정 요약 (S-25 텍스트로 복사·이미지로 저장). 예약번호·메모는 넣지 않는다 (docs/08 D1).
 * 일정 화면과 같게: 그날 일정 + 그날 예약(항공·기차·식당·투어 등, 시간순) + 그날 밤 숙소
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
  const liveBookings = bookings.filter((b) => !b.deletedAt);
  getTripDays(trip.startDate, trip.endDate).forEach((date, i) => {
    const itemLines = live
      .filter((it) => it.date === date)
      .sort((a, b) => (a.order < b.order ? -1 : 1))
      .map((it) => ({
        t: it.startTime,
        text: [time(it.startTime), it.title].filter(Boolean).join(' '),
      }));
    // 예약 줄: 일정과 시간순으로 섞는다 (시간 없는 것은 일정 뒤)
    const bookingLines = bookingRowsForDay(liveBookings, date).map((r) => ({
      t: r.time,
      text: [
        time(r.time),
        bookingIcon(r.booking.kind),
        r.booking.title,
        r.part === 'arrive' ? '(도착)' : '',
      ]
        .filter(Boolean)
        .join(' '),
    }));
    const day = mergeByTime(itemLines, bookingLines);
    const lodging = liveBookings.find(
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
  // 여행 기간 밖 날짜에 남은 일정도 빠뜨리지 않는다 (기간을 줄인 경우)
  const days = new Set(getTripDays(trip.startDate, trip.endDate));
  const outside = live
    .filter((it) => it.date !== null && !days.has(it.date))
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : a.order < b.order ? -1 : 1))
    .map(
      (it) =>
        `${formatMonthDay(it.date!)} ${[time(it.startTime), it.title].filter(Boolean).join(' ')}`,
    );
  if (outside.length) lines.push('', '[여행 기간 밖 일정]', ...outside);
  const wish = live.filter((it) => it.date === null).map((it) => `· ${it.title}`);
  if (wish.length) lines.push('', '[가고 싶은 곳]', ...wish);
  return lines.join('\n');
}

const ICON: Record<Booking['kind'], string> = {
  flight: '✈',
  lodging: '🛏',
  restaurant: '🍽',
  train: '🚆',
  car: '🚗',
  transfer: '🚐',
  tour: '🎫',
  ticket: '🎟',
  other: '📌',
};
const bookingIcon = (kind: Booking['kind']) => ICON[kind];

/**
 * 일정은 사용자가 정한 순서 그대로, 예약은 시간에 맞는 자리에 끼운다
 * (그 예약 시각보다 늦은 첫 일정 앞, 없으면 맨 뒤 — 시간 없는 예약도 맨 뒤)
 */
function mergeByTime(
  items: readonly { t: string | undefined; text: string }[],
  bookings: readonly { t: string | undefined; text: string }[],
): string[] {
  const out = [...items];
  const sorted = [...bookings].sort((a, b) => (a.t ?? '99').localeCompare(b.t ?? '99'));
  for (const b of sorted) {
    const at = b.t ? out.findIndex((x) => x.t !== undefined && x.t > b.t!) : -1;
    if (at === -1) out.push(b);
    else out.splice(at, 0, b);
  }
  return out.map((x) => x.text);
}
