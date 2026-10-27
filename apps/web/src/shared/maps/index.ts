import type { ActiveMapId, MapHandle, MapOptions, MapProviderId } from './types';

export type { ActiveMapId, LatLng, MapHandle, MapMarker, MapProviderId } from './types';

/** 빌드 때 넣는 브라우저 키 (Cloudflare Pages 환경 변수). 없으면 그 제공자는 못 씀 */
export const MAP_KEYS: Record<MapProviderId, string | undefined> = {
  google: import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined,
  naver: import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined,
  kakao: import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined,
};

/**
 * 어떤 지도를 쓸까: 해외는 늘 Google, 국내는 설정에서 고른 네이버·카카오 (2026-10-28).
 * 고른 지도의 키가 없으면 다른 국내 지도 → Google 순, 다 없으면 null
 */
export function chooseProvider(
  domestic: boolean,
  pref: 'naver' | 'kakao' = 'naver',
  keys = MAP_KEYS,
): MapProviderId | null {
  const order: MapProviderId[] = domestic
    ? [pref, pref === 'naver' ? 'kakao' : 'naver', 'google']
    : ['google', 'naver', 'kakao'];
  return order.find((id) => keys[id]) ?? null;
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
  if (id === 'kakao') return (await import('./kakaoMap')).mountKakao(el, opts, key);
  return (await import('./naverMap')).mountNaver(el, opts, key);
}
