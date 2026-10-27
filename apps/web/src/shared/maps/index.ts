import type { ActiveMapId, MapHandle, MapOptions, MapProviderId } from './types';

export type { ActiveMapId, LatLng, MapHandle, MapMarker, MapProviderId } from './types';

/** 빌드 때 넣는 브라우저 키 (Cloudflare Pages 환경 변수). 없으면 그 제공자는 못 씀 */
export const MAP_KEYS: Record<MapProviderId, string | undefined> = {
  google: import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined,
  naver: import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined,
};

/**
 * 어떤 지도를 쓸까 (docs/10 §3): 여행 설정 > 앱 설정 > 자동(국내=네이버, 해외=구글).
 * 고른 제공자 키가 없으면 다른 쪽, 둘 다 없으면 null
 */
export function chooseProvider(
  pref: 'auto' | MapProviderId,
  domestic: boolean,
  keys = MAP_KEYS,
): MapProviderId | null {
  // 해외는 늘 Google, 국내는 네이버 (2026-10-27 — 국내 지도만 고르게 했고, 지금 앱 안 국내 지도는 네이버뿐)
  void pref;
  const wanted: MapProviderId = domestic ? 'naver' : 'google';
  if (keys[wanted]) return wanted;
  const other: MapProviderId = wanted === 'google' ? 'naver' : 'google';
  return keys[other] ? other : null;
}

/** 지도 SDK는 지도를 열 때만 불러온다 */
export async function mountMap(
  id: ActiveMapId,
  el: HTMLElement,
  opts: MapOptions,
): Promise<MapHandle> {
  // 키가 없는 무료 지도 (Google·네이버를 못 쓸 때)
  if (id === 'osm') return (await import('./osmMap')).mountOsm(el, opts);
  const key = MAP_KEYS[id];
  if (!key) throw new Error('no key');
  if (id === 'google') return (await import('./googleMap')).mountGoogle(el, opts, key);
  return (await import('./naverMap')).mountNaver(el, opts, key);
}
