import { addDays, diffDays, type LocalDate } from './localDate';
import { nightsBetween } from './tripLength';

/** 여행 기간의 날짜 목록 (Day는 저장하지 않고 계산한다 — docs/04 §2) */
export function getTripDays(start: LocalDate, end: LocalDate): LocalDate[] {
  const nights = nightsBetween(start, end);
  return Array.from({ length: nights + 1 }, (_, i) => addDays(start, i));
}

export type TripStatus = 'upcoming' | 'ongoing' | 'past';

export function getTripStatus(start: LocalDate, end: LocalDate, today: LocalDate): TripStatus {
  if (diffDays(today, start) > 0) return 'upcoming';
  if (diffDays(end, today) > 0) return 'past';
  return 'ongoing';
}

/** 여행 시작까지 남은 일수 (오늘 출발이면 0, 지났으면 음수) */
export function daysUntil(start: LocalDate, today: LocalDate): number {
  return diffDays(today, start);
}

/** 여행 중이면 몇 일차인지 (1부터), 아니면 null */
export function dayNumberOf(start: LocalDate, end: LocalDate, date: LocalDate): number | null {
  if (diffDays(start, date) < 0 || diffDays(date, end) < 0) return null;
  return diffDays(start, date) + 1;
}
