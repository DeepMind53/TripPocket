import {
  compareKeys,
  distanceKm,
  nightsBetween,
  type Booking,
  type ItemKind,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';

/** 이보다 가까운 일정 사이는 걸어서, 먼 곳은 대중교통·차로 갔다고 어림 (직선거리) */
const WALK_KM = 2;
/** 서울 시청 — "가장 멀리 간 여행" 기준점 */
const SEOUL = { lat: 37.5665, lng: 126.978 };

export interface TravelStats {
  trips: number;
  days: number;
  /** 다녀온(미방문이 아닌) 좌표 있는 일정 사이 직선거리 합, km */
  walkKm: number;
  transitKm: number;
  flights: number;
  places: number;
  topCountry?: { code: string; trips: number } | undefined;
  topKind?: { kind: ItemKind; count: number } | undefined;
  longest?: { title: string; days: number } | undefined;
  farthest?: { title: string; km: number } | undefined;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 기록 탭 "여행 회고" (실험실, 사용자 요청 2026-10-26): 다녀온 여행 전체를 쌓아 센 기록.
 * 이동 거리는 같은 날 앞뒤 일정 좌표 사이 직선거리로 어림 — 2km 안은 걷기, 넘으면 대중교통·차.
 * 항공 이동(공항 일정 사이)은 거리에서 빼고 탑승 횟수로만 센다. 미방문으로 남긴 일정은 뺀다
 */
export function travelStats(
  pastTrips: readonly Trip[],
  items: readonly ItineraryItem[],
  bookings: readonly Booking[],
): TravelStats {
  const ids = new Set(pastTrips.map((t) => t.id));
  const mine = items.filter((i) => ids.has(i.tripId) && !i.deletedAt && i.visit !== 'skipped');

  let walkKm = 0;
  let transitKm = 0;
  const byDay = new Map<string, ItineraryItem[]>();
  for (const i of mine) {
    if (!i.date) continue;
    const k = `${i.tripId}|${i.date}`;
    byDay.set(k, [...(byDay.get(k) ?? []), i]);
  }
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => compareKeys(a.order, b.order));
    for (let n = 1; n < sorted.length; n++) {
      const a = sorted[n - 1]!;
      const b = sorted[n]!;
      if (!a.place?.coords || !b.place?.coords) continue;
      if (a.transport?.mode === 'flight' || b.transport?.mode === 'flight') continue;
      const km = distanceKm(a.place.coords, b.place.coords);
      if (km <= WALK_KM) walkKm += km;
      else transitKm += km;
    }
  }

  const flights = bookings.filter(
    (b) => ids.has(b.tripId) && !b.deletedAt && b.kind === 'flight',
  ).length;

  const countryTrips = new Map<string, number>();
  for (const t of pastTrips)
    for (const c of new Set(t.destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []))))
      countryTrips.set(c, (countryTrips.get(c) ?? 0) + 1);
  const topCountry = [...countryTrips].sort((a, b) => b[1] - a[1])[0];

  const kinds = new Map<ItemKind, number>();
  for (const i of mine) if (i.kind !== 'note') kinds.set(i.kind, (kinds.get(i.kind) ?? 0) + 1);
  const topKind = [...kinds].sort((a, b) => b[1] - a[1])[0];

  const lengths = pastTrips.map((t) => ({
    title: t.title,
    days: nightsBetween(t.startDate, t.endDate) + 1,
  }));
  const longest = [...lengths].sort((a, b) => b.days - a.days)[0];

  const far = pastTrips
    .flatMap((t) =>
      t.destinations.flatMap((d) =>
        d.coords ? [{ title: t.title, km: Math.round(distanceKm(SEOUL, d.coords)) }] : [],
      ),
    )
    .sort((a, b) => b.km - a.km)[0];

  return {
    trips: pastTrips.length,
    days: lengths.reduce((s, l) => s + l.days, 0),
    walkKm: round1(walkKm),
    transitKm: round1(transitKm),
    flights,
    places: mine.filter((i) => i.kind !== 'note' && i.place).length,
    topCountry: topCountry ? { code: topCountry[0], trips: topCountry[1] } : undefined,
    topKind: topKind ? { kind: topKind[0], count: topKind[1] } : undefined,
    longest,
    farthest: far,
  };
}
