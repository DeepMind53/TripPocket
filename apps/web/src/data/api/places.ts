import type { PlaceDetails, PlaceSummary } from '@trippocket/shared';
import { api } from './client';

/** 장소 검색 (서버 프록시, 로그인 필요 — docs/10 §3.1). 여행지 좌표는 본문으로만 */
export const placesApi = {
  search: (q: string, scope: 'domestic' | 'overseas', near?: { lat: number; lng: number }) =>
    api<{
      places: PlaceSummary[];
      google: boolean;
      /** 무료량이 끝나 백업으로 찾았으면 그 제공자 (docs/23) */
      fallback?: 'google_autocomplete' | 'geoapify';
    }>('/api/places/search', {
      method: 'POST',
      body: JSON.stringify({ q, scope, ...(near ? { near } : {}) }),
    }),
  /** 평점·영업시간 — 볼 때마다 조회, 저장하지 않음 (Google 약관) */
  googleDetails: (placeId: string) =>
    api<PlaceDetails>(`/api/places/google/${encodeURIComponent(placeId)}`),
  /** 택시 카드 현지어 이름 — Google(장소 id) → 무료량이 끝나면 Geoapify(좌표, 본문으로만) */
  localName: (body: { placeId?: string; coords?: { lat: number; lng: number }; lang: string }) =>
    api<{ name?: string; address?: string; source?: 'osm' }>('/api/places/local', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

/**
 * Google 자동완성 백업 결과는 좌표·주소가 없다 → 고를 때 같은 세션으로 받아 채운다 (docs/23 §1).
 * 받지 못하면 이름·간단 주소만 (지도 핀 없음)
 */
export async function resolvePlace(p: PlaceSummary): Promise<PlaceSummary> {
  if (p.coords || !p.session || p.source !== 'google') return p;
  const r = await api<{ address?: string; coords: { lat: number; lng: number } | null }>(
    `/api/places/google/${encodeURIComponent(p.id)}/basic?session=${encodeURIComponent(p.session)}`,
  );
  const { session: _session, ...rest } = p;
  if (!r.ok) return rest;
  return { ...rest, address: r.data.address ?? p.address, coords: r.data.coords };
}
