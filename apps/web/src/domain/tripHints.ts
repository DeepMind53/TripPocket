import {
  addDays,
  distanceKm,
  type Booking,
  type Coords,
  type LocalDate,
  type Trip,
} from '@trippocket/shared';
import { weatherLook, type DayWeather } from './weather';

/**
 * 2026-11-13 새 실험 (사용자 요청 "10개 이상, 가진 정보로 도움이 되는 것"): 서버·외부 요청 없이 기기에 있는 정보로 계산.
 * 화면은 features/labs/*
 */

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** 오늘의 한마디: 여행 N일차마다 다른 문장 (ids 순서대로 돌아감) */
export function phraseOfDay<T>(ids: readonly T[], dayN: number): T {
  return ids[(((dayN - 1) % ids.length) + ids.length) % ids.length]!;
}

/**
 * 걷기 좋은 시간: 지금 시 ~ 21시 중 비·눈·뇌우가 없고 8~27°인 시간이 2시간 넘게 이어지는 가장 긴 구간.
 * 같은 길이면 이른 쪽. to = 끝나는 시 (14~17시 = 14·15·16시)
 */
export function bestWalkWindow(
  hours: DayWeather['hours'],
  fromHour: number,
): { from: number; to: number } | null {
  if (!hours) return null;
  const good = (h: number) => {
    const c = hours.code[h];
    const t = hours.temp[h];
    if (c === undefined || t === undefined) return false;
    const k = weatherLook(c).kind;
    return k !== 'rain' && k !== 'drizzle' && k !== 'storm' && k !== 'snow' && t >= 8 && t <= 27;
  };
  let best: { from: number; to: number } | null = null;
  let start = -1;
  for (let h = Math.max(0, fromHour); h <= 21; h++) {
    if (good(h)) {
      if (start < 0) start = h;
      if (!best || h + 1 - start > best.to - best.from) best = { from: start, to: h + 1 };
    } else start = -1;
  }
  return best && best.to - best.from >= 2 ? best : null;
}

/** 해 지기까지 남은 분 (이미 졌거나 3시간보다 많이 남으면 null — 늦은 오후에만) */
export function daylightLeft(now: string, sunset: string): number | null {
  const m = mins(sunset) - mins(now);
  return m > 0 && m <= 180 ? m : null;
}

type Spot = { id: string; title: string; coords: Coords };

const pathKm = (list: readonly Spot[]) =>
  list.reduce((sum, s, i) => (i === 0 ? 0 : sum + distanceKm(list[i - 1]!.coords, s.coords)), 0);

/**
 * 더 짧은 순서: 첫 장소는 그대로 두고, 남은 곳을 가장 가까운 곳부터 차례로 이었을 때
 * 직선 합이 1km 넘게, 15% 넘게 줄면 그 순서 (장소 3곳부터). 바꾸지는 않고 알려만 준다
 */
export function shorterOrder(spots: readonly Spot[]): { titles: string[]; saveKm: number } | null {
  if (spots.length < 3) return null;
  const rest = spots.slice(1);
  const out: Spot[] = [spots[0]!];
  while (rest.length) {
    const last = out[out.length - 1]!;
    let k = 0;
    for (let i = 1; i < rest.length; i++)
      if (distanceKm(last.coords, rest[i]!.coords) < distanceKm(last.coords, rest[k]!.coords))
        k = i;
    out.push(rest.splice(k, 1)[0]!);
  }
  const now = pathKm(spots);
  const better = pathKm(out);
  const save = now - better;
  if (save < 1 || save / now < 0.15) return null;
  return { titles: out.map((s) => s.title), saveKm: Math.round(save * 10) / 10 };
}

/**
 * 멀리 떨어진 장소: 여행 전체 장소 좌표의 가운데(위도·경도 중앙값)에서 80km 넘게 떨어진 곳 —
 * 같은 이름 다른 도시를 잘못 고른 경우 (장소 4곳부터, 여러 도시 여행은 도시마다 가운데가 달라 빼지 않는다)
 */
export const FAR_PLACE_KM = 80;
export function farPlaceIds(spots: readonly Spot[], all: readonly Coords[]): Set<string> {
  const out = new Set<string>();
  if (all.length < 4) return out;
  const mid = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)]!;
  };
  const center = { lat: mid(all.map((c) => c.lat)), lng: mid(all.map((c) => c.lng)) };
  // 절반 넘게 가운데에서 멀면 여러 도시 여행 — 알리지 않는다
  const far = all.filter((c) => distanceKm(center, c) > FAR_PLACE_KM).length;
  if (far * 2 >= all.length) return out;
  for (const s of spots) if (distanceKm(center, s.coords) > FAR_PLACE_KM) out.add(s.id);
  return out;
}

/** 다시 찾은 도시: 이 여행보다 먼저 끝난 여행 중 같은 목적지(이름)가 있는 것, 가장 최근 것 */
export function earlierTripTo(trip: Trip, trips: readonly Trip[]): Trip | null {
  const names = new Set(trip.destinations.map((d) => d.name.trim()));
  return (
    trips
      .filter(
        (o) =>
          o.id !== trip.id &&
          !o.deletedAt &&
          o.endDate < trip.startDate &&
          o.destinations.some((d) => names.has(d.name.trim())),
      )
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null
  );
}

/** N년 전 오늘: 지난해들의 오늘(월·일)에 여행 중이었던 여행 — 가장 가까운 해 */
export function memoryOfToday(
  trips: readonly Trip[],
  today: LocalDate,
): { trip: Trip; years: number; dayN: number } | null {
  const md = today.slice(5);
  const year = Number(today.slice(0, 4));
  for (let y = year - 1; y >= year - 10; y--) {
    const day = `${y}-${md}`;
    const trip = trips.find((o) => !o.deletedAt && o.startDate <= day && day <= o.endDate);
    if (trip) {
      const dayN = Math.round((Date.parse(day) - Date.parse(trip.startDate)) / 86_400_000) + 1;
      return { trip, years: year - y, dayN };
    }
  }
  return null;
}

/** 서울과 기온 비교: 하루 평균 기온 차 (반올림, +면 여행지가 따뜻함) */
export function tempDiff(dest: DayWeather, home: DayWeather): number {
  return Math.round((dest.min + dest.max) / 2 - (home.min + home.max) / 2);
}

/** 한국 연휴와 겹침: 출발 전날 ~ 돌아오는 다음 날 사이 한국 공휴일 이름 (중복 없이) */
export function krHolidaysNear(
  trip: Pick<Trip, 'startDate' | 'endDate'>,
  holidays: Record<LocalDate, string>,
): string[] {
  const from = addDays(trip.startDate, -1);
  const to = addDays(trip.endDate, 1);
  return [
    ...new Set(
      Object.entries(holidays)
        .filter(([d]) => d >= from && d <= to)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, name]) => name),
    ),
  ];
}

export type BookingIssue =
  | { kind: 'outside'; title: string; date: LocalDate }
  | { kind: 'stayAfterFlight'; title: string; date: LocalDate }
  | { kind: 'lateArrival'; title: string; time: string };

/**
 * 예약 날짜 맞춰 보기:
 * - 여행 기간 밖에 시작하는 예약 (날짜를 잘못 넣은 경우)
 * - 마지막 항공편 출발일보다 늦게 체크아웃하는 숙소
 * - 밤 10시 넘어 도착하는 항공편 (숙소에 늦은 체크인 알리기)
 */
export function bookingIssues(
  trip: Pick<Trip, 'startDate' | 'endDate'>,
  bookings: readonly Booking[],
): BookingIssue[] {
  const live = bookings.filter((b) => !b.deletedAt);
  const out: BookingIssue[] = [];
  for (const b of live)
    if (b.start.date < addDays(trip.startDate, -1) || b.start.date > trip.endDate)
      out.push({ kind: 'outside', title: b.title, date: b.start.date });
  const flights = live
    .filter((b) => b.kind === 'flight')
    .sort((a, b) => a.start.date.localeCompare(b.start.date));
  const lastFlight = flights.length > 1 ? flights[flights.length - 1] : undefined;
  if (lastFlight)
    for (const b of live)
      if (b.kind === 'lodging' && b.end && b.end.date > lastFlight.start.date)
        out.push({ kind: 'stayAfterFlight', title: b.title, date: b.end.date });
  for (const f of flights) {
    const at = f.end?.time;
    if (at && at >= '22:00' && f !== lastFlight)
      out.push({ kind: 'lateArrival', title: f.title, time: at });
  }
  return out;
}
