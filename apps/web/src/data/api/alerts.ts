import type { AlertsResponse } from '@trippocket/shared';
import { api } from './client';

/**
 * 여행지 기상·재난 특보 (docs/24, ADR-0008) — 나라 코드만 보낸다.
 * 이 기기에 1시간 보관, 오프라인이면 마지막 결과(확인 시각과 함께)
 */
const KEY = 'tp-alerts';
const FRESH_MS = 60 * 60 * 1000;

type Store = Record<string, { at: number; data: AlertsResponse }>;

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
}

function save(store: Store): void {
  try {
    // 나라 조합이 바뀌어도 최근 5개만
    const entries = Object.entries(store)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, 5);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // 저장 못 해도 이번 결과는 쓴다
  }
}

export interface AlertsResult {
  data: AlertsResponse;
  /** 지난 결과 (새로 받지 못함) */
  stale: boolean;
}

export async function fetchAlerts(countries: readonly string[]): Promise<AlertsResult | null> {
  const k = [...new Set(countries)].sort().join(',');
  if (!k) return null;
  const store = load();
  const hit = store[k];
  if (hit && Date.now() - hit.at < FRESH_MS) return { data: hit.data, stale: false };
  const res = await api<AlertsResponse>(`/api/alerts?countries=${encodeURIComponent(k)}`);
  if (!res.ok || !Array.isArray(res.data.alerts))
    return hit ? { data: hit.data, stale: true } : null;
  store[k] = { at: Date.now(), data: res.data };
  save(store);
  return { data: res.data, stale: false };
}
