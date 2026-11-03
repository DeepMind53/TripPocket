/**
 * 새로 만드는 예약·일정의 시각 초기값 (사용자 요청 2026-11-04):
 * 숙소 체크인 15:00 · 체크아웃 11:00, 음식점(예약·일정) 12:00.
 * 종류를 바꾸면 앞 종류의 초기값 그대로인 칸만 새 종류 값으로 바꾼다 (직접 고친 시각은 그대로)
 */
export interface DefaultTimes {
  start: string;
  end: string;
}

const BOOKING: Record<string, DefaultTimes> = {
  lodging: { start: '15:00', end: '11:00' },
  restaurant: { start: '12:00', end: '' },
};
const ITEM: Record<string, DefaultTimes> = {
  food: { start: '12:00', end: '' },
};
const NONE: DefaultTimes = { start: '', end: '' };

export function bookingDefaultTimes(kind: string): DefaultTimes {
  return BOOKING[kind] ?? NONE;
}
export function itemDefaultTimes(kind: string): DefaultTimes {
  return ITEM[kind] ?? NONE;
}

/** 종류를 바꿀 때의 시각: 비었거나 앞 종류의 초기값이면 새 초기값으로 */
export function switchTimes(cur: DefaultTimes, from: DefaultTimes, to: DefaultTimes): DefaultTimes {
  const pick = (v: string, a: string, b: string) => (v === '' || v === a ? b : v);
  return { start: pick(cur.start, from.start, to.start), end: pick(cur.end, from.end, to.end) };
}
