import type { ActiveMapId } from '../../shared/maps';
import { api } from './client';

/**
 * 브라우저에서 바로 부르는 외부 API(지도 SDK·날씨·공휴일·jsDelivr) 사용량 — 서버 routes/usage.ts.
 * 부르기 전에 externalAllowed, 부른 뒤 reportExternal. id는 서버 services/apiUsage.ts의 browser: true 항목.
 * 서버에 닿지 않으면(오프라인·홈 PC 꺼짐) 허용: 각 서비스 콘솔의 할당량이 마지막 안전장치
 */
export type BrowserApi =
  | 'google_maps_js'
  | 'naver_maps_js'
  | 'kakao_maps_js'
  | 'openfreemap'
  | 'open_meteo'
  | 'nager_date'
  | 'jsdelivr';

const FLAGS_TTL = 5 * 60_000;
const DENY_ALL: Record<BrowserApi, boolean> = {
  google_maps_js: false,
  naver_maps_js: false,
  kakao_maps_js: false,
  openfreemap: false,
  open_meteo: false,
  nager_date: false,
  jsdelivr: false,
};
let flags: { at: number; apis: Partial<Record<BrowserApi, boolean>> | null } | null = null;
let pending: Promise<Partial<Record<BrowserApi, boolean>> | null> | null = null;

async function loadFlags(): Promise<Partial<Record<BrowserApi, boolean>> | null> {
  if (flags && Date.now() - flags.at < FLAGS_TTL) return flags.apis;
  pending ??= api<{ maps: boolean; apis?: Partial<Record<BrowserApi, boolean>> }>(
    '/api/usage/flags',
  ).then((res) => {
    // 예전 서버(apis 없음)는 Google 지도만 알려 준다
    // 로그인 안 됨(401) → 모두 막음. 서버에 닿지 않음 → null(허용, 로그인했던 기기의 오프라인)
    const apis = res.ok
      ? (res.data.apis ?? { google_maps_js: res.data.maps })
      : res.reason === 'unauthorized'
        ? DENY_ALL
        : null;
    flags = { at: Date.now(), apis };
    pending = null;
    return apis;
  });
  return pending;
}

/** 지금 불러도 되나 (관리자가 멈췄거나 자동 상한이면 false) */
export async function externalAllowed(id: BrowserApi): Promise<boolean> {
  return (await loadFlags())?.[id] !== false;
}

/** 1회 사용 기록 (실패해도 기능은 그대로) */
export function reportExternal(id: BrowserApi): void {
  void api('/api/usage/map-load', { method: 'POST', body: JSON.stringify({ api: id }) });
}

const MAP_API: Record<ActiveMapId, BrowserApi> = {
  google: 'google_maps_js',
  naver: 'naver_maps_js',
  kakao: 'kakao_maps_js',
  osm: 'openfreemap',
};
export const mapAllowed = (provider: ActiveMapId) => externalAllowed(MAP_API[provider]);
export const reportMapLoad = (provider: ActiveMapId) => reportExternal(MAP_API[provider]);

/** 시험용 */
export const resetUsageFlags = () => {
  flags = null;
  pending = null;
};
