import {
  diffDays,
  type Booking,
  type ItineraryItem,
  type LocalDate,
  type LocalTime,
} from '@trippocket/shared';

export interface LodgingNight {
  booking: Booking;
  /** 몇 번째 밤 (1부터) */
  night: number;
  /** 전체 박 수 */
  nights: number;
}

/**
 * 그날 밤 묵는 숙소 (docs/04 §3 Booking: start.date ≤ d < end.date — 체크아웃 날은 제외).
 * 숙소 예약이 겹치면 체크인이 늦은 쪽 (옮겨 간 숙소).
 */
export function lodgingForNight(
  bookings: readonly Booking[],
  date: LocalDate,
): LodgingNight | null {
  let found: LodgingNight | null = null;
  for (const b of bookings) {
    if (b.kind !== 'lodging' || !b.end) continue;
    const nights = diffDays(b.start.date, b.end.date);
    const night = diffDays(b.start.date, date) + 1;
    if (night >= 1 && night <= nights) {
      if (!found || diffDays(found.booking.start.date, b.start.date) > 0) {
        found = { booking: b, night, nights };
      }
    }
  }
  return found;
}

/** 지금 시각 이후 첫 일정 (안 다녀온 것). 시간 없는 일정은 시간 있는 일정이 다 지난 뒤 순서대로 */
export function nextItem(dayItems: readonly ItineraryItem[], now: LocalTime): ItineraryItem | null {
  const pending = dayItems.filter((i) => !i.done);
  return (
    pending.find((i) => i.startTime && i.startTime >= now) ??
    pending.find((i) => !i.startTime) ??
    null
  );
}

/** 여행지 시간대의 지금 시각 "HH:mm" */
export function nowTimeIn(timezone: string, now: Date = new Date()): LocalTime {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

/** "HH:mm"까지 남은 분 (지났으면 음수) */
export function minutesUntil(from: LocalTime, to: LocalTime): number {
  const m = (t: LocalTime) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(to) - m(from);
}

export interface BookingRow {
  booking: Booking;
  /** 항공권이 다음 날 도착하면 도착일에는 'arrive' */
  part: 'start' | 'arrive';
  time: LocalTime | undefined;
}

/**
 * 그날 일정 위에 보여줄 예약 (숙소 제외 — 숙소는 날짜 아래 띠로).
 * 항공권은 출발일, 그리고 도착일이 다르면 도착일에도. 시간순.
 */
export function bookingRowsForDay(bookings: readonly Booking[], date: LocalDate): BookingRow[] {
  const rows: BookingRow[] = [];
  for (const b of bookings) {
    if (b.kind === 'lodging') continue;
    if (b.start.date === date) rows.push({ booking: b, part: 'start', time: b.start.time });
    else if (b.kind === 'flight' && b.end?.date === date)
      rows.push({ booking: b, part: 'arrive', time: b.end.time });
  }
  return rows.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
}
