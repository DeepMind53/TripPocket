import type { Booking, ItineraryItem, LocalDate } from '@trippocket/shared';

/**
 * 여행 도움 계산 모음 — 기기 안 데이터로만 계산하는 순수 함수.
 * 시차 안내(2026-10-28 정식)와 실험실 2차(2026-10-28, 다른 여행 앱 참고). 시간대 계산은 Intl만 쓴다
 */

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

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

/** 시차 안내: 여행지가 집보다 몇 시간 빠른지 (+ 빠름, - 느림, 소수 가능) */
export function hoursAhead(tripTz: string, homeTz = 'Asia/Seoul', at = Date.now()): number {
  return (offsetMinutes(tripTz, at) - offsetMinutes(homeTz, at)) / 60;
}

/** ① 공항 도착 권장 시각: 국제선 3시간 전, 국내선 1시간 30분 전. 자정 전으로 넘어가면 prevDay */
export function airportArriveBy(
  departTime: string,
  domestic: boolean,
): { time: string; prevDay: boolean; before: number } {
  const before = domestic ? 90 : 180;
  const m = minutes(departTime) - before;
  return { time: hhmm(m), prevDay: m < 0, before };
}

/**
 * ③ 시간 겹침: 시각이 있는 일정을 시간 순으로 보고, 앞 일정이 끝나기 전에(끝 시각이 있으면) 또는
 * 같은 시각에 시작하는 일정 id
 */
export function overlappingIds(
  items: readonly Pick<ItineraryItem, 'id' | 'kind' | 'startTime' | 'endTime'>[],
): Set<string> {
  const timed = items
    .filter((i) => i.kind !== 'note' && i.startTime)
    .sort((a, b) => minutes(a.startTime!) - minutes(b.startTime!));
  const out = new Set<string>();
  for (let n = 1; n < timed.length; n++) {
    const prev = timed[n - 1]!;
    const cur = timed[n]!;
    const start = minutes(cur.startTime!);
    const prevStart = minutes(prev.startTime!);
    const prevEnd = prev.endTime ? minutes(prev.endTime) : null;
    if (start === prevStart || (prevEnd !== null && prevEnd > prevStart && start < prevEnd))
      out.add(cur.id);
  }
  return out;
}

/** ④ 골든아워: 해 지기 한 시간 전부터 (사진 찍기 좋은 빛) */
export const goldenHourStart = (sunset: string): string => hhmm(minutes(sunset) - 60);

/** ⑧ 늦은 귀가: 그날 마지막 일정이 22시 이후에 시작하거나 끝나면 그 시각 */
export function lateNightAt(
  items: readonly Pick<ItineraryItem, 'kind' | 'startTime' | 'endTime'>[],
): string | null {
  let latest: string | null = null;
  for (const i of items) {
    if (i.kind === 'note') continue;
    for (const t of [i.startTime, i.endTime])
      if (t && t >= '22:00' && (!latest || t > latest)) latest = t;
  }
  return latest;
}

/**
 * ⑩ 체크인 전 짐 보관: 그날 도착하는 항공편이 체크인 시각보다 2시간 넘게 이르면
 * (공항에서 나오는 데 1시간을 더해) 남는 시간. 아니면 null
 */
export function luggageGap(
  bookings: readonly Booking[],
  date: LocalDate,
): { hours: number; checkIn: string; name: string } | null {
  const live = bookings.filter((b) => !b.deletedAt);
  const arrive = live
    .filter((b) => b.kind === 'flight' && b.end?.date === date && b.end.time)
    .map((b) => b.end!.time!)
    .sort()
    .at(-1);
  const stay = live.find((b) => b.kind === 'lodging' && b.start.date === date && b.start.time);
  if (!arrive || !stay) return null;
  const gap = minutes(stay.start.time!) - (minutes(arrive) + 60);
  if (gap < 120) return null;
  return { hours: Math.floor(gap / 60), checkIn: stay.start.time!, name: stay.title };
}

/** ⑤ 콘센트·전압 (나라별 플러그 모양·전압). 한국 플러그(C·F형, 220V)가 그대로 맞는지 */
const PLUGS: Record<string, { types: string; volt: number }> = {
  JP: { types: 'A·B', volt: 100 },
  CN: { types: 'A·C·I', volt: 220 },
  TW: { types: 'A·B', volt: 110 },
  HK: { types: 'G', volt: 220 },
  MO: { types: 'G·D·M', volt: 220 },
  TH: { types: 'A·B·C·O', volt: 220 },
  VN: { types: 'A·C', volt: 220 },
  PH: { types: 'A·B·C', volt: 220 },
  SG: { types: 'G', volt: 230 },
  MY: { types: 'G', volt: 240 },
  ID: { types: 'C·F', volt: 230 },
  KH: { types: 'A·C·G', volt: 230 },
  LA: { types: 'A·B·C·E·F', volt: 230 },
  MN: { types: 'C·E', volt: 230 },
  IN: { types: 'C·D·M', volt: 230 },
  US: { types: 'A·B', volt: 120 },
  GU: { types: 'A·B', volt: 110 },
  MP: { types: 'A·B', volt: 110 },
  CA: { types: 'A·B', volt: 120 },
  MX: { types: 'A·B', volt: 127 },
  AU: { types: 'I', volt: 230 },
  NZ: { types: 'I', volt: 230 },
  GB: { types: 'G', volt: 230 },
  IE: { types: 'G', volt: 230 },
  FR: { types: 'C·E', volt: 230 },
  DE: { types: 'C·F', volt: 230 },
  IT: { types: 'C·F·L', volt: 230 },
  ES: { types: 'C·F', volt: 230 },
  PT: { types: 'C·F', volt: 230 },
  NL: { types: 'C·F', volt: 230 },
  BE: { types: 'C·E', volt: 230 },
  CH: { types: 'C·J', volt: 230 },
  AT: { types: 'C·F', volt: 230 },
  CZ: { types: 'C·E', volt: 230 },
  GR: { types: 'C·F', volt: 230 },
  TR: { types: 'C·F', volt: 230 },
  AE: { types: 'G', volt: 230 },
  EG: { types: 'C·F', volt: 220 },
};
export function plugInfo(
  countryCode: string,
): { types: string; volt: number; adapter: boolean; lowVolt: boolean } | null {
  const p = PLUGS[countryCode];
  if (!p) return null;
  // 한국 플러그(C·F)는 C·E·F 콘센트에 꽂힌다
  const fits = /[CEF]/.test(p.types);
  return { ...p, adapter: !fits, lowVolt: p.volt < 200 };
}

/** ⑥ 여행 진행률: 며칠째 / 며칠, 메모 빼고 다녀온 일정 / 오늘까지 일정 */
export function tripProgress(
  trip: { startDate: LocalDate; endDate: LocalDate },
  items: readonly Pick<ItineraryItem, 'kind' | 'date' | 'done' | 'visit'>[],
  today: LocalDate,
): { day: number; days: number; done: number; total: number } {
  const dayMs = 86_400_000;
  const days = Math.round((Date.parse(trip.endDate) - Date.parse(trip.startDate)) / dayMs) + 1;
  const day = Math.min(
    days,
    Math.round((Date.parse(today) - Date.parse(trip.startDate)) / dayMs) + 1,
  );
  const upToToday = items.filter((i) => i.kind !== 'note' && i.date && i.date <= today);
  const done = upToToday.filter((i) => i.done || i.visit === 'visited').length;
  return { day, days, done, total: upToToday.length };
}

/** ⑦ 메모 체크박스: "- " / "* " 로 시작하는 줄. checked = "- [x] ..." */
export interface MemoLine {
  text: string;
  /** 체크 줄이 아니면 null */
  checked: boolean | null;
}
const CHECK_RE = /^\s*[-*]\s+(?:\[( |x|X)\]\s*)?(.*)$/;
export function memoLines(memo: string): MemoLine[] {
  return memo.split('\n').map((line) => {
    const m = CHECK_RE.exec(line);
    return m
      ? { text: m[2] ?? '', checked: m[1] === 'x' || m[1] === 'X' }
      : { text: line, checked: null };
  });
}
/** n번째 줄의 체크를 바꾼 메모 */
export function toggleMemoLine(memo: string, n: number): string {
  const lines = memo.split('\n');
  const m = CHECK_RE.exec(lines[n] ?? '');
  if (!m) return memo;
  const on = m[1] === 'x' || m[1] === 'X';
  lines[n] = `- [${on ? ' ' : 'x'}] ${m[2] ?? ''}`;
  return lines.join('\n');
}
