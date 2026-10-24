/**
 * 사용량 한도로 API를 못 쓸 때 대신 여는 공식 페이지 (사용자 요청 2026-10-25).
 * 앱이 API로 받던 정보를 사용자가 그 서비스에서 직접 보게 한다 — 우리 서버·키를 쓰지 않음
 */
export type FallbackId =
  'naverMap' | 'kakaoMap' | 'googleMap' | 'naverBlog' | 'flight' | 'fx' | 'weather';

export interface FallbackLink {
  id: FallbackId;
  url: string;
}

const enc = encodeURIComponent;

/** 장소 검색: 국내 = 네이버·카카오 지도, 해외 = Google 지도 */
export function placeSearchLinks(query: string, domestic: boolean): FallbackLink[] {
  const q = query.trim();
  if (!q) return [];
  return domestic
    ? [
        { id: 'naverMap', url: `https://map.naver.com/p/search/${enc(q)}` },
        { id: 'kakaoMap', url: `https://map.kakao.com/?q=${enc(q)}` },
      ]
    : [{ id: 'googleMap', url: `https://www.google.com/maps/search/?api=1&query=${enc(q)}` }];
}

/** 한 장소(영업시간·평점 등 상세) */
export function placeDetailLinks(name: string, googlePlaceId?: string): FallbackLink[] {
  const id = googlePlaceId ? `&query_place_id=${enc(googlePlaceId)}` : '';
  return [
    { id: 'googleMap', url: `https://www.google.com/maps/search/?api=1&query=${enc(name)}${id}` },
  ];
}

/** AI 추천 대신: 네이버 블로그 검색 + 지도 검색 */
export function recommendLinks(query: string, domestic: boolean): FallbackLink[] {
  const q = query.trim();
  if (!q) return [];
  return [
    { id: 'naverBlog', url: `https://search.naver.com/search.naver?where=blog&query=${enc(q)}` },
    ...placeSearchLinks(q, domestic),
  ];
}

export const flightLink = (flightNo: string): FallbackLink => ({
  id: 'flight',
  url: `https://www.flightradar24.com/data/flights/${enc(flightNo.replace(/\s+/g, '').toLowerCase())}`,
});

export const fxLink = (code?: string): FallbackLink => ({
  id: 'fx',
  url: `https://search.naver.com/search.naver?query=${enc(code ? `${code} 환율` : '환율')}`,
});

export const weatherLink = (city: string): FallbackLink => ({
  id: 'weather',
  url: `https://search.naver.com/search.naver?query=${enc(`${city} 날씨`)}`,
});

export function openFallback(link: FallbackLink): void {
  window.open(link.url, '_blank', 'noopener');
}
