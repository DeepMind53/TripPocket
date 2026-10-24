/** 여행지 기준 달력 날짜 "YYYY-MM-DD" (타임존 없음). docs/04-data-model.md §1 */
export type LocalDate = string;
/** 현지 시각 "HH:mm" (24시간) */
export type LocalTime = string;

export const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const LOCAL_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const DAY_MS = 86_400_000;

/**
 * LocalDate를 UTC 자정 기준 일수(epoch day)로 바꾼다.
 * `new Date("YYYY-MM-DD")`는 환경에 따라 하루가 밀릴 수 있어 직접 파싱한다.
 */
export function toEpochDay(date: LocalDate): number {
  const m = LOCAL_DATE_RE.exec(date);
  if (!m) throw new Error(`올바르지 않은 날짜 형식: ${date}`);
  const [, y, mo, d] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const check = new Date(ms);
  if (check.getUTCMonth() !== Number(mo) - 1 || check.getUTCDate() !== Number(d)) {
    throw new Error(`존재하지 않는 날짜: ${date}`);
  }
  return ms / DAY_MS;
}

export function fromEpochDay(day: number): LocalDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function isLocalDate(value: string): boolean {
  try {
    toEpochDay(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** b - a (일) */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return toEpochDay(b) - toEpochDay(a);
}

/** 요일 0(일)~6(토) */
export function weekday(date: LocalDate): number {
  // 1970-01-01은 목요일(4)
  return (((toEpochDay(date) + 4) % 7) + 7) % 7;
}

/**
 * 특정 타임존의 "오늘" 날짜. 여행 중엔 기기 시계가 아니라 여행지 기준이어야 한다.
 * timezone이 없으면 기기 타임존.
 */
export function todayIn(timezone?: string, now: Date = new Date()): LocalDate {
  // en-CA 형식이 YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * 직접 친 시간을 "HH:mm"으로 (시계 대신 타이핑, 사용자 요청 2026-10-24).
 * "930"·"0930"·"9:30"·"9.30"·"9시30분" → "09:30", "9"·"21" → "09:00"·"21:00". 틀리면 null
 */
export function parseTypedTime(input: string): string | null {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) return null;
  let h: number;
  let m: number;
  const sep = /^(\d{1,2})[:.시h](\d{1,2})?분?$/i.exec(s);
  if (sep) {
    h = Number(sep[1]);
    m = sep[2] ? Number(sep[2]) : 0;
  } else if (/^\d{1,4}$/.test(s)) {
    if (s.length <= 2) {
      h = Number(s);
      m = 0;
    } else {
      h = Number(s.slice(0, s.length - 2));
      m = Number(s.slice(-2));
    }
  } else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
