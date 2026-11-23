import {
  choseong,
  distanceKm,
  normalize,
  type ItineraryItem,
  type LocalDate,
  type Trip,
} from '@trippocket/shared';
import { samePlace } from './visit';

/**
 * 기록 탭 "방문 기록" 화면 (사용자 결정 2026-11-24, docs/32): 여행별·도시별·장소별 보기와 검색.
 * 일정에는 도시 칸이 없어 여행 목적지로 계산한다 — 서버·외부 API 없이 기기 안에서만
 */

/** 목적지 도시와 이 거리 안이면 그 도시로 본다 (km) */
const CITY_KM = 80;

export interface VisitCity {
  /** 여러 여행의 같은 도시를 한 칸으로 합치는 키 (나라 + 이름) */
  key: string;
  name: string;
  countryCode?: string | undefined;
}

type VisitItem = Pick<
  ItineraryItem,
  'id' | 'tripId' | 'date' | 'kind' | 'title' | 'place' | 'memo' | 'visit' | 'order'
>;

const cityOf = (d: Trip['destinations'][number]): VisitCity => ({
  key: `${d.countryCode ?? ''}:${normalize(d.name)}`,
  name: d.name,
  countryCode: d.countryCode,
});

/**
 * 일정이 있는 도시: ① 목적지 도시가 하나면 그곳 ② 일정 좌표에서 가장 가까운 목적지 도시(80km 안)
 * ③ 주소·장소 이름에 도시 이름이 나오는 곳 ④ 모르면 null ("기타 지역")
 */
export function visitCity(
  item: Pick<ItineraryItem, 'place' | 'title'>,
  trip: Pick<Trip, 'destinations'> | undefined,
): VisitCity | null {
  const cities = (trip?.destinations ?? []).filter((d) => d.kind !== 'country');
  if (cities.length === 0) return null;
  if (cities.length === 1) return cityOf(cities[0]!);
  const at = item.place?.coords;
  if (at) {
    let best: { d: (typeof cities)[number]; km: number } | null = null;
    for (const d of cities) {
      if (!d.coords) continue;
      const km = distanceKm(at, d.coords);
      if (km <= CITY_KM && (!best || km < best.km)) best = { d, km };
    }
    if (best) return cityOf(best.d);
  }
  const text = `${item.place?.address ?? ''} ${item.place?.name ?? ''} ${item.title}`;
  const named = cities.find((d) => text.includes(d.name));
  return named ? cityOf(named) : null;
}

/** 검색: 장소 이름·주소·메모·여행 제목·도시 이름. 초성만 치면 초성으로 */
export function matchesVisit(
  query: string,
  item: VisitItem,
  trip: Pick<Trip, 'title'> | undefined,
  city: VisitCity | null,
): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  const onlyCho = /^[ㄱ-ㅎ]+$/.test(q);
  return [item.title, item.place?.name, item.place?.address, item.memo, trip?.title, city?.name]
    .filter((s): s is string => !!s)
    .some((s) => {
      const n = normalize(s);
      return n.includes(q) || (onlyCho && choseong(n).includes(q));
    });
}

const byDateThenOrder = (a: VisitItem, b: VisitItem) =>
  (a.date ?? '').localeCompare(b.date ?? '') || a.order.localeCompare(b.order);

export interface TripVisitGroup<T extends VisitItem> {
  tripId: string;
  trip: Trip | undefined;
  visited: number;
  /** 날짜별 (오래된 날 먼저). 날짜 없는 일정은 date null */
  days: { date: LocalDate | null; items: T[] }[];
}

/** 여행별 → 날짜별. 최근 여행 먼저 */
export function groupByTrip<T extends VisitItem>(
  items: readonly T[],
  trips: ReadonlyMap<string, Trip>,
): TripVisitGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const i of items) map.set(i.tripId, [...(map.get(i.tripId) ?? []), i]);
  return [...map]
    .map(([tripId, list]) => {
      const days = new Map<LocalDate | null, T[]>();
      for (const i of [...list].sort(byDateThenOrder))
        days.set(i.date, [...(days.get(i.date) ?? []), i]);
      return {
        tripId,
        trip: trips.get(tripId),
        visited: list.filter((i) => i.visit === 'visited').length,
        days: [...days].map(([date, dayItems]) => ({ date, items: dayItems })),
      };
    })
    .sort((a, b) => (b.trip?.startDate ?? '').localeCompare(a.trip?.startDate ?? ''));
}

export interface CityVisitGroup<T extends VisitItem> {
  /** null = 기타 지역 */
  city: VisitCity | null;
  items: T[];
  visited: number;
  tripCount: number;
}

/** 도시별. 방문이 많은 도시 먼저, 기타 지역은 맨 끝. 안에서는 최근 날짜 먼저 */
export function groupByCity<T extends VisitItem>(
  items: readonly T[],
  trips: ReadonlyMap<string, Trip>,
): CityVisitGroup<T>[] {
  const map = new Map<string, { city: VisitCity | null; items: T[] }>();
  for (const i of items) {
    const city = visitCity(i, trips.get(i.tripId));
    const key = city?.key ?? '';
    const g = map.get(key) ?? { city, items: [] };
    g.items.push(i);
    map.set(key, g);
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => byDateThenOrder(b, a)),
      visited: g.items.filter((i) => i.visit === 'visited').length,
      tripCount: new Set(g.items.map((i) => i.tripId)).size,
    }))
    .sort(
      (a, b) =>
        Number(a.city === null) - Number(b.city === null) ||
        b.visited - a.visited ||
        b.items.length - a.items.length,
    );
}

export interface PlaceVisitGroup<T extends VisitItem> {
  /** 대표 (가장 최근 기록) */
  head: T;
  /** 오래된 날짜 먼저 */
  items: T[];
  visited: number;
}

/** 장소별 (다시 간 곳): 같은 장소(samePlace)끼리. 방문 많은 곳 먼저, 같으면 최근 */
export function groupByPlace<T extends VisitItem>(items: readonly T[]): PlaceVisitGroup<T>[] {
  const groups: T[][] = [];
  for (const i of items) {
    const g = groups.find((list) => samePlace(list[0]!, i));
    if (g) g.push(i);
    else groups.push([i]);
  }
  return groups
    .map((list) => {
      const sorted = [...list].sort(byDateThenOrder);
      return {
        head: sorted[sorted.length - 1]!,
        items: sorted,
        visited: list.filter((i) => i.visit === 'visited').length,
      };
    })
    .sort((a, b) => b.visited - a.visited || (b.head.date ?? '').localeCompare(a.head.date ?? ''));
}
