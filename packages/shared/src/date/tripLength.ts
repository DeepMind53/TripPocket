import { toEpochDay, type LocalDate } from './localDate';

/** 시작일~종료일 사이의 박 수. 종료일이 시작일보다 빠르면 오류. */
export function nightsBetween(start: LocalDate, end: LocalDate): number {
  const nights = toEpochDay(end) - toEpochDay(start);
  if (nights < 0) throw new Error('종료일이 시작일보다 빨라요');
  return nights;
}

/** "4박 5일" / 당일치기는 "당일치기" (docs/11-design-system.md §9.1) */
export function formatTripLength(start: LocalDate, end: LocalDate): string {
  const nights = nightsBetween(start, end);
  return nights === 0 ? '당일치기' : `${nights}박 ${nights + 1}일`;
}
