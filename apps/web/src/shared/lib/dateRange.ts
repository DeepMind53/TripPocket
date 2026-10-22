import { addDays, diffDays, toEpochDay, weekday, type LocalDate } from '@trippocket/shared';

export interface DateRange {
  start: LocalDate | null;
  end: LocalDate | null;
}

/**
 * 달력에서 날짜를 눌렀을 때 다음 범위.
 * 처음 누르면 출발일, 다음에 누르면 도착일(같은 날 = 당일치기). 출발일보다 앞을 누르면 출발일을 다시 고른다.
 */
export function pickRange(range: DateRange, date: LocalDate): DateRange {
  if (!range.start || range.end) return { start: date, end: null };
  if (diffDays(range.start, date) < 0) return { start: date, end: null };
  return { start: range.start, end: date };
}

export function isInRange(range: DateRange, date: LocalDate): boolean {
  if (!range.start || !range.end) return false;
  return diffDays(range.start, date) >= 0 && diffDays(date, range.end) >= 0;
}

export interface MonthGrid {
  /** "YYYY-MM" */
  key: string;
  year: number;
  month: number;
  /** 첫 주 앞의 빈칸 수 (일요일 시작) */
  leading: number;
  days: LocalDate[];
}

/** from이 속한 달부터 count개월 */
export function buildMonths(from: LocalDate, count: number): MonthGrid[] {
  const months: MonthGrid[] = [];
  let [y, m] = from.split('-').map(Number) as [number, number];
  for (let i = 0; i < count; i++) {
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const length = toEpochDay(`${nextY}-${String(nextM).padStart(2, '0')}-01`) - toEpochDay(first);
    months.push({
      key: first.slice(0, 7),
      year: y,
      month: m,
      leading: weekday(first),
      days: Array.from({ length }, (_, d) => addDays(first, d)),
    });
    y = nextY;
    m = nextM;
  }
  return months;
}
