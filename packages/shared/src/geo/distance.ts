/**
 * 두 좌표 사이 직선거리(하버사인)·대략 걸어서 걸리는 시간 — 웹(실험실 "다음 장소까지 거리")과 서버(AI 추천 거리 거르기) 공용.
 * 실제 길은 더 길다 → 직선거리 × 1.3, 시속 4.5km로 어림 (길찾기 앱 안내가 정확)
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/** 직선거리 (km, 하버사인) */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const DETOUR = 1.3;
const WALK_KMH = 4.5;

/** 걸어서 대략 몇 분 (1분 단위 올림) */
export const walkMinutes = (km: number): number => Math.ceil(((km * DETOUR) / WALK_KMH) * 60);

/** 표시용: 1km 미만은 m(10m 단위), 그 이상은 km 소수 1자리 */
export const formatDistance = (km: number): string =>
  km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)}m` : `${km.toFixed(1)}km`;

/**
 * 대한민국 안(제주·울릉도·독도 포함 대략의 경계 상자)인가 — 국내 지도·길찾기 앱 고르기용.
 * 상자에 걸치는 일본(쓰시마·이키·후쿠오카 등 규슈 북부·야마구치·고토)은 뺀다
 */
export const inKorea = (c: LatLng): boolean =>
  c.lat > 33 &&
  c.lat < 38.7 &&
  c.lng > 124.5 &&
  c.lng < 131.9 &&
  !(c.lat < 34.85 && c.lng > 128.9) &&
  !(c.lat < 33.4 && c.lng > 128.3);
