import type { Coords, RouteEta } from '@trippocket/shared';
import { guardApi, trackApi } from './apiUsage';

/**
 * 두 장소 사이 걸어서·대중교통 소요 시간 (실험실 "출발 시각 알려 주기", 사용자 결정 2026-10-26).
 * - Google에서 받은 좌표가 끼면 Google Routes (약관상 다른 회사로 보내지 않는다), 아니면 Geoapify
 * - Google Routes: Compute Routes Essentials(걷기·대중교통은 기본 기능) 월 10,000 무료
 * - Geoapify: 걷기 + approximated_transit(OSM 노선으로 어림) — 하루 3,000 크레딧을 검색 백업과 같이 씀
 * 좌표는 일정 장소의 좌표(내 위치가 아님)이고, 요청에만 쓰고 저장·로그하지 않는다.
 * 같은 두 곳은 메모리에만 하루 보관해 다시 부르지 않는다
 */
const timeout = () => AbortSignal.timeout(8000);
const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; eta: RouteEta }>();

const key = (a: Coords, b: Coords, provider: string) =>
  [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(4)).join(',') + provider;

function cached(k: string): RouteEta | undefined {
  const hit = cache.get(k);
  if (!hit) return undefined;
  if (Date.now() - hit.at > DAY_MS) {
    cache.delete(k);
    return undefined;
  }
  return hit.eta;
}

function remember(k: string, eta: RouteEta): RouteEta {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(k, { at: Date.now(), eta });
  return eta;
}

/** 시험용: 메모리 보관 비우기 */
export function clearRouteCache(): void {
  cache.clear();
}

const minutesOf = (seconds: number | undefined) =>
  seconds === undefined || !Number.isFinite(seconds)
    ? undefined
    : Math.max(1, Math.round(seconds / 60));

async function googleOne(
  from: Coords,
  to: Coords,
  mode: 'WALK' | 'TRANSIT',
  apiKey: string,
): Promise<number | undefined> {
  guardApi('google_routes');
  trackApi('google_routes');
  const ll = (c: Coords) => ({ location: { latLng: { latitude: c.lat, longitude: c.lng } } });
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      // 시간만 — 다른 필드를 받으면 더 비싼 등급이 될 수 있다
      'X-Goog-FieldMask': 'routes.duration',
    },
    body: JSON.stringify({ origin: ll(from), destination: ll(to), travelMode: mode }),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`google routes ${res.status}`);
  const d = (await res.json()) as { routes?: { duration?: string }[] };
  // "754s" 꼴
  const raw = d.routes?.[0]?.duration;
  return minutesOf(raw ? Number.parseFloat(raw) : undefined);
}

export async function googleEta(from: Coords, to: Coords, apiKey: string): Promise<RouteEta> {
  const k = key(from, to, 'g');
  const hit = cached(k);
  if (hit) return hit;
  const [walk, transit] = await Promise.all([
    googleOne(from, to, 'WALK', apiKey),
    // 대중교통 노선이 없는 곳(가까운 거리 등)은 빈 결과 — 실패로 보지 않는다
    googleOne(from, to, 'TRANSIT', apiKey).catch(() => undefined),
  ]);
  return remember(k, { walk, transit, source: 'google' });
}

async function geoapifyOne(
  from: Coords,
  to: Coords,
  mode: 'walk' | 'approximated_transit',
  apiKey: string,
): Promise<number | undefined> {
  guardApi('geoapify');
  trackApi('geoapify');
  const url = new URL('https://api.geoapify.com/v1/routing');
  url.searchParams.set('waypoints', `${from.lat},${from.lng}|${to.lat},${to.lng}`);
  url.searchParams.set('mode', mode);
  url.searchParams.set('apiKey', apiKey);
  const res = await fetch(url, { signal: timeout() });
  if (!res.ok) throw new Error(`geoapify routing ${res.status}`);
  const d = (await res.json()) as { features?: { properties?: { time?: number } }[] };
  return minutesOf(d.features?.[0]?.properties?.time);
}

export async function geoapifyEta(from: Coords, to: Coords, apiKey: string): Promise<RouteEta> {
  const k = key(from, to, 'o');
  const hit = cached(k);
  if (hit) return hit;
  const [walk, transit] = await Promise.all([
    geoapifyOne(from, to, 'walk', apiKey),
    geoapifyOne(from, to, 'approximated_transit', apiKey).catch(() => undefined),
  ]);
  return remember(k, { walk, transit, source: 'osm' });
}
