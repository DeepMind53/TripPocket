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

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * 새 일정의 시작 시각 (docs/31 C3, 2026-11-25): 그날 일정이 모두 끝나는 시각 (종료가 없는 일정은 시작 + 1시간).
 * 시간 입력 간격(분)에 맞춰 올리고, 그날 시각 있는 일정이 없거나 24:00을 넘으면 빈 값
 */
export function nextStartAfter(
  items: readonly { startTime?: string | undefined; endTime?: string | undefined }[],
  stepMin: number,
): string {
  let last = -1;
  for (const i of items) {
    if (!i.startTime) continue;
    const start = toMin(i.startTime);
    const end = i.endTime && toMin(i.endTime) > start ? toMin(i.endTime) : start + 60;
    last = Math.max(last, end);
  }
  if (last < 0) return '';
  const step = Math.max(1, stepMin);
  const m = Math.ceil(last / step) * step;
  if (m >= 24 * 60) return '';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
