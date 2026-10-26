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
  guardApi('kakao_keyword');
  trackApi('kakao_keyword');
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
    ...(d.phone ? { phone: d.phone } : {}),
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
      ...(it.telephone ? { phone: it.telephone } : {}),
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

/**
 * 택시용 현지어 이름·주소 (docs/20 G4): 그 나라 말로 장소 이름·주소만.
 * Place Details Pro 등급(이름) — 무료 월 5,000회. 저장하지 않고 보여 주기만 (Google 약관)
 */
export async function googleLocalName(
  placeId: string,
  lang: string,
  key: string,
): Promise<{ name?: string | undefined; address?: string | undefined }> {
  guardApi('google_places_local');
  trackApi('google_places_local');
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(lang)}`,
    {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'displayName,formattedAddress' },
      signal: timeout(),
    },
  );
  if (!res.ok) throw new Error(`google ${res.status}`);
  const d = (await res.json()) as { displayName?: { text?: string }; formattedAddress?: string };
  return { name: d.displayName?.text, address: d.formattedAddress };
}

/**
 * 백업 ① Google 자동완성 (docs/23 §1): Text Search가 이번 달 무료량을 다 썼을 때.
 * 결과에는 좌표·주소가 없다 → 고를 때 googleBasicDetails(같은 세션)로 받는다
 */
export async function autocompleteGoogle(
  q: string,
  key: string,
  session: string,
  near?: { lat: number; lng: number },
): Promise<PlaceSummary[]> {
  guardApi('google_autocomplete');
  trackApi('google_autocomplete');
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({
      input: q,
      languageCode: 'ko',
      sessionToken: session,
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
  if (!res.ok) throw new Error(`google ac ${res.status}`);
  const body = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }[];
  };
  return (body.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p?.placeId) return [];
    return [
      {
        source: 'google' as const,
        id: p.placeId,
        name: p.structuredFormat?.mainText?.text ?? '',
        address: p.structuredFormat?.secondaryText?.text ?? '',
        coords: null,
        session,
      },
    ];
  });
}

/** 자동완성에서 고른 장소의 주소·좌표 (Place Details Essentials — 이름·평점 같은 비싼 필드는 부르지 않음) */
export async function googleBasicDetails(
  placeId: string,
  key: string,
  session?: string,
): Promise<{ address?: string | undefined; coords: { lat: number; lng: number } | null }> {
  guardApi('google_details_basic');
  trackApi('google_details_basic');
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', 'ko');
  if (session) url.searchParams.set('sessionToken', session);
  const res = await fetch(url, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'formattedAddress,location' },
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`google basic ${res.status}`);
  const d = (await res.json()) as {
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  };
  return {
    address: d.formattedAddress,
    coords: d.location ? { lat: d.location.latitude, lng: d.location.longitude } : null,
  };
}

interface GeoapifyResult {
  place_id?: string;
  name?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  lat?: number;
  lon?: number;
  category?: string;
}

/**
 * 백업 ② Geoapify 검색 (OpenStreetMap 데이터, 무료 하루 3,000) — Google 백업까지 멈췄을 때.
 * 출처 표기 필수: 화면에 "Powered by Geoapify · © OpenStreetMap" (docs/23 §1)
 */
export async function searchGeoapify(
  q: string,
  key: string,
  near?: { lat: number; lng: number },
): Promise<PlaceSummary[]> {
  guardApi('geoapify');
  trackApi('geoapify');
  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.set('text', q);
  url.searchParams.set('lang', 'ko');
  url.searchParams.set('limit', '8');
  url.searchParams.set('format', 'json');
  if (near) url.searchParams.set('bias', `proximity:${near.lng},${near.lat}`);
  url.searchParams.set('apiKey', key);
  const res = await fetch(url, { signal: timeout() });
  if (!res.ok) throw new Error(`geoapify ${res.status}`);
  const body = (await res.json()) as { results?: GeoapifyResult[] };
  return (body.results ?? []).map((r) => {
    const name = r.name || r.address_line1 || r.formatted || '';
    const coords =
      typeof r.lat === 'number' && typeof r.lon === 'number' ? { lat: r.lat, lng: r.lon } : null;
    return {
      source: 'osm' as const,
      id: r.place_id ?? `${name}|${r.lat},${r.lon}`,
      name,
      address: (r.name ? r.formatted : r.address_line2) ?? '',
      coords,
      ...(r.category ? { category: r.category.split('.').at(-1) } : {}),
      ...(coords
        ? {
            url: `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=18/${coords.lat}/${coords.lng}`,
          }
        : {}),
    };
  });
}

/**
 * 택시 카드 백업: 좌표 → 그 나라 말 이름·주소 (Geoapify 역지오코딩).
 * 좌표는 요청에만 쓰고 저장·로그하지 않는다 (CLAUDE.md)
 */
export async function geoapifyLocalName(
  coords: { lat: number; lng: number },
  lang: string,
  key: string,
): Promise<{ name?: string | undefined; address?: string | undefined }> {
  guardApi('geoapify');
  trackApi('geoapify');
  const url = new URL('https://api.geoapify.com/v1/geocode/reverse');
  url.searchParams.set('lat', String(coords.lat));
  url.searchParams.set('lon', String(coords.lng));
  // Geoapify는 두 글자 언어 코드 (zh-TW → zh)
  url.searchParams.set('lang', lang.split('-')[0]!);
  url.searchParams.set('format', 'json');
  url.searchParams.set('apiKey', key);
  const res = await fetch(url, { signal: timeout() });
  if (!res.ok) throw new Error(`geoapify ${res.status}`);
  const r = ((await res.json()) as { results?: GeoapifyResult[] }).results?.[0];
  return { name: r?.name, address: r?.formatted };
}
