import type { Coords, RouteEta } from '@trippocket/shared';
import { api } from './client';

/** 이 기기에 7일 보관 (같은 두 장소는 다시 묻지 않는다 — 무료량 아끼기) */
const KEY = 'tp-route-eta';
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const MAX = 200;

type Store = Record<string, { at: number; eta: RouteEta }>;
const pairKey = (a: Coords, b: Coords) =>
  [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(4)).join(',');

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
}

function save(store: Store): void {
  const entries = Object.entries(store)
    .filter(([, v]) => Date.now() - v.at < KEEP_MS)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // 저장 못 해도 이번 결과는 쓴다
  }
}

/**
 * 두 일정 장소 사이 걸어서·대중교통 소요 시간 (실험실 "출발 시각", 서버가 Google Routes·Geoapify로).
 * google = 둘 중 하나라도 Google에서 받은 좌표. 실패하면 null (화면은 직선거리 어림으로)
 */
export async function routeEta(
  from: Coords,
  to: Coords,
  google: boolean,
): Promise<RouteEta | null> {
  const k = pairKey(from, to);
  const store = load();
  const hit = store[k];
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.eta;
  const res = await api<RouteEta>('/api/routes/eta', {
    method: 'POST',
    body: JSON.stringify({ from, to, google }),
  });
  if (!res.ok) return null;
  store[k] = { at: Date.now(), eta: res.data };
  save(store);
  return res.data;
}
