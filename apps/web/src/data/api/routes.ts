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

/** 오늘 남은 길 조회 수 (서버가 알려 준 마지막 값, 한국 날짜 기준 — 한 사람 하루 50번, 2026-11-10) */
const LEFT_KEY = 'tp-route-left';
const kstDay = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

export function routeLeftToday(): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(LEFT_KEY) ?? 'null') as {
      day: string;
      left: number;
    } | null;
    return v && v.day === kstDay() ? v.left : null;
  } catch {
    return null;
  }
}

function rememberLeft(left: number | undefined): void {
  if (left === undefined) return;
  try {
    localStorage.setItem(LEFT_KEY, JSON.stringify({ day: kstDay(), left }));
  } catch {
    // 표시만 못 할 뿐
  }
}

/** 길 조회 결과: 오늘 한도를 다 썼으면 limited (화면은 직선거리 어림으로) */
export type RouteEtaResult = { eta: RouteEta | null; limited: boolean };

/**
 * 두 일정 장소 사이 걸어서·대중교통 소요 시간 (서버가 Google Routes·Geoapify로).
 * google = 둘 중 하나라도 Google에서 받은 좌표. 실패하면 eta null (화면은 직선거리 어림으로)
 */
export async function routeEtaResult(
  from: Coords,
  to: Coords,
  google: boolean,
  /** 출발점이 지금 내 위치: 약 100m로 줄여 보내고, 기기·서버 어디에도 보관하지 않는다 */
  live = false,
): Promise<RouteEtaResult> {
  const ask = async (body: object): Promise<RouteEtaResult> => {
    const res = await api<RouteEta>('/api/routes/eta', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      rememberLeft(res.data.left);
      return { eta: res.data, limited: false };
    }
    if (res.code === 'route_daily') {
      rememberLeft(0);
      return { eta: null, limited: true };
    }
    return { eta: null, limited: false };
  };
  if (live) {
    const round = (c: Coords) => ({
      lat: Math.round(c.lat * 1000) / 1000,
      lng: Math.round(c.lng * 1000) / 1000,
    });
    return ask({ from: round(from), to, google, live: true });
  }
  const k = pairKey(from, to);
  const store = load();
  const hit = store[k];
  if (hit && Date.now() - hit.at < KEEP_MS) return { eta: hit.eta, limited: false };
  const r = await ask({ from, to, google });
  if (r.eta) {
    const { left: _left, ...eta } = r.eta;
    store[k] = { at: Date.now(), eta };
    save(store);
  }
  return r;
}
