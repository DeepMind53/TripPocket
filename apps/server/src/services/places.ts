import type { PlaceDetails, PlaceSummary } from '@trippocket/shared';
import { naverSearchRequest, type NaverKeys } from './naverBlog';
import { guardApi, trackApi } from './apiUsage';

/**
 * 장소 검색 제공자 (docs/10, 결정 L6: 네이버·카카오 무료 + Google 무료 한도).
 * Google FieldMask는 여기서 고정 — 비싼 필드를 실수로 부르지 않게 (docs/10 §6.2)
 * 검색 = Pro 등급(이름·주소·좌표, 월 5천 무료), 상세(평점·영업시간) = Enterprise(월 1천 무료)
 */
const strip = (s: unknown) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .trim();
const timeout = () => AbortSignal.timeout(8000);

export async function searchKakao(
  q: string,
  key: string,
  near?: { lat: number; lng: number },
): Promise<PlaceSummary[]> {
  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', q);
  url.searchParams.set('size', '10');
  if (near) {
    url.searchParams.set('x', String(near.lng));
    url.searchParams.set('y', String(near.lat));
  }
  guardApi('kakao_local');
  trackApi('kakao_local');
  const res = await fetch(url, { headers: { authorization: `KakaoAK ${key}` }, signal: timeout() });
  if (!res.ok) throw new Error(`kakao ${res.status}`);
  const body = (await res.json()) as { documents?: Record<string, string>[] };
  return (body.documents ?? []).map((d) => ({
    source: 'kakao' as const,
    id: String(d.id ?? ''),
    name: String(d.place_name ?? ''),
    address: d.road_address_name || d.address_name || '',
    coords: d.y && d.x ? { lat: Number(d.y), lng: Number(d.x) } : null,
    category: d.category_name?.split(' > ').at(-1),
    url: d.place_url,
  }));
}

export async function searchNaver(q: string, keys: NaverKeys): Promise<PlaceSummary[]> {
  const [url, headers] = naverSearchRequest(
    keys,
    'local',
    new URLSearchParams({ query: q, display: '5' }),
  );
  guardApi('naver_search');
  trackApi('naver_search');
  const res = await fetch(url, {
    headers,
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`naver ${res.status}`);
  const body = (await res.json()) as { items?: Record<string, string>[] };
  return (body.items ?? []).map((it) => {
    // 새 지역 검색 응답 좌표 = WGS84 × 10^7
    const lng = Number(it.mapx) / 1e7;
    const lat = Number(it.mapy) / 1e7;
    const name = strip(it.title);
    return {
      source: 'naver' as const,
      id: `${name}|${it.mapx}|${it.mapy}`,
      name,
      address: it.roadAddress || it.address || '',
      coords: Number.isFinite(lat) && lat !== 0 ? { lat, lng } : null,
      category: it.category?.split('>').at(-1),
      url: `https://map.naver.com/p/search/${encodeURIComponent(name)}`,
    };
  });
}

export async function searchGoogle(
  q: string,
  key: string,
  near?: { lat: number; lng: number },
): Promise<PlaceSummary[]> {
  guardApi('google_places_search');
  trackApi('google_places_search');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri',
    },
    body: JSON.stringify({
      textQuery: q,
      languageCode: 'ko',
      maxResultCount: 8,
      ...(near
        ? {
            locationBias: {
              circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 30000 },
            },
          }
        : {}),
    }),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const body = (await res.json()) as {
    places?: {
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      googleMapsUri?: string;
    }[];
  };
  return (body.places ?? []).map((p) => ({
    source: 'google' as const,
    id: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    coords: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
    url: p.googleMapsUri,
  }));
}

const hm = (t?: { hour?: number; minute?: number }) =>
  `${String(t?.hour ?? 0).padStart(2, '0')}:${String(t?.minute ?? 0).padStart(2, '0')}`;

export async function googleDetails(placeId: string, key: string): Promise<PlaceDetails> {
  guardApi('google_places_details');
  trackApi('google_places_details');
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ko`,
    {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'rating,userRatingCount,regularOpeningHours,currentOpeningHours.openNow,nationalPhoneNumber,websiteUri,googleMapsUri',
      },
      signal: timeout(),
    },
  );
  if (!res.ok) throw new Error(`google ${res.status}`);
  const d = (await res.json()) as {
    rating?: number;
    userRatingCount?: number;
    regularOpeningHours?: {
      weekdayDescriptions?: string[];
      periods?: {
        open?: { day?: number; hour?: number; minute?: number };
        close?: { day?: number; hour?: number; minute?: number };
      }[];
    };
    currentOpeningHours?: { openNow?: boolean };
    nationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
  };
  return {
    rating: d.rating,
    userRatingCount: d.userRatingCount,
    weekdayText: d.regularOpeningHours?.weekdayDescriptions,
    openNow: d.currentOpeningHours?.openNow,
    periods: d.regularOpeningHours?.periods?.map((p) => ({
      day: p.open?.day ?? 0,
      open: hm(p.open),
      // 닫는 시각이 없으면 24시간
      close: p.close ? hm(p.close) : '24:00',
    })),
    phone: d.nationalPhoneNumber,
    website: d.websiteUri,
    googleMapsUrl: d.googleMapsUri,
  };
}
