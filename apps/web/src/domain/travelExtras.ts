import { addDays, type Booking, type ItineraryItem, type LocalDate } from '@trippocket/shared';

/**
 * 실험실 (2026-10-27, 다른 여행 앱 참고) — 기기 안 데이터로만 계산하는 순수 함수 모음.
 * 시간대 계산은 Intl만 쓴다 (라이브러리 없음)
 */

/** 그 시간대에서 이 순간의 UTC와의 차이(분) */
function offsetMinutes(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(at / 60_000) * 60_000) / 60_000);
}

/** 그 시간대의 "날짜 시각" → 실제 순간(ms). 잘못된 시간대면 null */
export function instantOf(date: LocalDate, time: string, timeZone: string): number | null {
  try {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    const [hh, mm] = time.split(':').map(Number) as [number, number];
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    // 두 번 고쳐 서머타임 경계도 맞춘다
    let at = guess - offsetMinutes(timeZone, guess) * 60_000;
    at = guess - offsetMinutes(timeZone, at) * 60_000;
    return at;
  } catch {
    return null;
  }
}

const hm = (at: number, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);

/**
 * 1) 한국(집) 시각 같이 보기: 여행지 "날짜 시각"을 집 시간대로. 두 시간대가 같으면 null
 */
export function homeTimeOf(
  date: LocalDate,
  time: string,
  tripTz: string,
  homeTz = 'Asia/Seoul',
): string | null {
  const at = instantOf(date, time, tripTz);
  if (at === null) return null;
  if (offsetMinutes(tripTz, at) === offsetMinutes(homeTz, at)) return null;
  return hm(at, homeTz);
}

/** 8) 시차(시간, 소수 가능): 여행지가 집보다 몇 시간 빠른지 (+ 빠름, - 느림) */
export function hoursAhead(tripTz: string, homeTz = 'Asia/Seoul', at = Date.now()): number {
  return (offsetMinutes(tripTz, at) - offsetMinutes(homeTz, at)) / 60;
}

/** 2) 비 예보(WMO 코드: 비·소나기·뇌우) */
export const isRainCode = (code: number) =>
  (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

/** 야외 일정 (비 오면 확인할 것) */
export const isOutdoor = (kind: ItineraryItem['kind']) => kind === 'place' || kind === 'activity';

/** 3) 그날 체크인하는 숙소 */
export function checkinsOn(
  bookings: readonly Booking[],
  date: LocalDate,
): { title: string; time?: string | undefined }[] {
  return bookings
    .filter((b) => b.kind === 'lodging' && !b.deletedAt && b.start.date === date)
    .map((b) => ({ title: b.title, time: b.start.time }));
}

/** 4) 귀국 전날: 여행 마지막 날 출발하는 항공편 (그 전날 보여 준다) */
export function returnFlightFor(
  bookings: readonly Booking[],
  tripEnd: LocalDate,
  date: LocalDate,
): { title: string; time?: string | undefined } | null {
  if (addDays(date, 1) !== tripEnd) return null;
  const f = bookings
    .filter((b) => b.kind === 'flight' && !b.deletedAt && b.start.date === tripEnd)
    .sort((a, b) => (a.start.time ?? '').localeCompare(b.start.time ?? ''))
    .at(-1);
  return f ? { title: f.title, time: f.start.time } : null;
}

/**
 * 6) 지금 비행 중인 항공편: 출발·도착 순간 사이면 { title, minutesLeft }.
 * 각 지점 시간대가 없으면 여행 시간대로 본다
 */
export function flightInAir(
  bookings: readonly Booking[],
  tripTz: string,
  now = Date.now(),
): { title: string; minutesLeft: number } | null {
  for (const b of bookings) {
    if (b.kind !== 'flight' || b.deletedAt || !b.start.time || !b.end?.time || !b.end.date)
      continue;
    const dep = instantOf(b.start.date, b.start.time, b.start.timezone ?? tripTz);
    const arr = instantOf(b.end.date, b.end.time, b.end.timezone ?? tripTz);
    if (dep === null || arr === null || arr <= dep) continue;
    if (now >= dep && now < arr)
      return { title: b.title, minutesLeft: Math.ceil((arr - now) / 60_000) };
  }
  return null;
}

/** 7) 오늘 요약: 일정 수(메모 빼고)·첫 일정 시각 */
export function todayBrief(items: readonly Pick<ItineraryItem, 'kind' | 'startTime'>[]): {
  count: number;
  first?: string | undefined;
} {
  const real = items.filter((i) => i.kind !== 'note');
  const first = real
    .map((i) => i.startTime)
    .filter((t): t is string => !!t)
    .sort()[0];
  return { count: real.length, first };
}

/** 10) 팁 계산: 금액·팁 비율(%) → 팁·합계 (소수 둘째 자리까지) */
export function tipOf(amount: number, percent: number): { tip: number; total: number } {
  const round = (n: number) => Math.round(n * 100) / 100;
  const tip = round((amount * percent) / 100);
  return { tip, total: round(amount + tip) };
}

/** 팁 문화가 있는 나라 (빠른 메뉴 팁 계산 바로가기를 보여 줄 곳) */
export const TIP_COUNTRIES: readonly string[] = ['US', 'CA', 'GU', 'MP'];
