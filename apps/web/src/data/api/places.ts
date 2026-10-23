import type { PlaceDetails, PlaceSummary } from '@trippocket/shared';
import { api } from './client';

/** 장소 검색 (서버 프록시, 로그인 필요 — docs/10 §3.1). 여행지 좌표는 본문으로만 */
export const placesApi = {
  search: (q: string, scope: 'domestic' | 'overseas', near?: { lat: number; lng: number }) =>
    api<{ places: PlaceSummary[]; google: boolean }>('/api/places/search', {
      method: 'POST',
      body: JSON.stringify({ q, scope, ...(near ? { near } : {}) }),
    }),
  /** 평점·영업시간 — 볼 때마다 조회, 저장하지 않음 (Google 약관) */
  googleDetails: (placeId: string) =>
    api<PlaceDetails>(`/api/places/google/${encodeURIComponent(placeId)}`),
};
