import type { ActiveMapId } from '../../shared/maps';
import { api } from './client';

/**
 * 브라우저에서 바로 부르는 외부 API(지도 SDK·날씨·공휴일·jsDelivr) 사용량 — 서버 routes/usage.ts.
 * 부르기 전에 externalAllowed, 부른 뒤 reportExternal. id는 서버 services/apiUsage.ts의 browser: true 항목.
 * 서버에 닿지 않으면(오프라인·홈 PC 꺼짐) 사용량을 셀 수 없으니 유료가 될 수 있는 지도 SDK만 막고
 * (무료 지도 OpenFreeMap으로) 무료 API는 허용 — 사용자 결정 2026-11-13. 각 콘솔의 하루 할당량은 그 위의 안전장치
 */
export type BrowserApi =
  | 'google_maps_js'
  | 'naver_maps_js'
  | 'kakao_maps_js'
  | 'openfreemap'
  | 'open_meteo'
  | 'nager_date'
  | 'jsdelivr'
  | 'frankfurter';

const FLAGS_TTL = 5 * 60_000;
const DENY_ALL: Record<BrowserApi, boolean> = {
  google_maps_js: false,
  naver_maps_js: false,
  kakao_maps_js: false,
  openfreemap: false,
  open_meteo: false,
  nager_date: false,
  jsdelivr: false,
  frankfurter: false,
};
/** 서버에 닿지 않을 때: 셀 수 없으니 과금될 수 있는 지도만 막는다 */
const UNCOUNTED: Partial<Record<BrowserApi, boolean>> = {
  google_maps_js: false,
  naver_maps_js: false,
  kakao_maps_js: false,
};
/** 서버에 닿지 않았던 결과는 짧게만 (서버가 돌아오면 곧 유료 지도로) */
const UNREACHABLE_TTL = 30_000;
let flags: { at: number; apis: Partial<Record<BrowserApi, boolean>> } | null = null;
let pending: Promise<Partial<Record<BrowserApi, boolean>>> | null = null;

async function loadFlags(): Promise<Partial<Record<BrowserApi, boolean>>> {
  if (flags && Date.now() - flags.at < (flags.apis === UNCOUNTED ? UNREACHABLE_TTL : FLAGS_TTL))
    return flags.apis;
  pending ??= api<{ maps: boolean; apis?: Partial<Record<BrowserApi, boolean>> }>(
    '/api/usage/flags',
  ).then((res) => {
    // 예전 서버(apis 없음)는 Google 지도만 알려 준다
    // 로그인 안 됨(401) → 모두 막음. 서버에 닿지 않음·오류 → 유료 지도만 막음 (무료 API는 오프라인에서도)
    const apis = res.ok
      ? (res.data.apis ?? { google_maps_js: res.data.maps })
      : res.reason === 'unauthorized'
        ? DENY_ALL
        : UNCOUNTED;
    flags = { at: Date.now(), apis };
    pending = null;
    return apis;
  });
  return pending;
}

/** 지금 불러도 되나 (관리자가 멈췄거나 자동 상한이면 false) */
export async function externalAllowed(id: BrowserApi): Promise<boolean> {
  return (await loadFlags())[id] !== false;
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
