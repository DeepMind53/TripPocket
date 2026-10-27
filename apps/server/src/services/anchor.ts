import { inKorea as inKoreaBox } from '@trippocket/shared';
import { guardApi, trackApi } from './apiUsage';

/**
 * AI 추천 기준점 (docs/14 §3-2): 좌표 → 가장 가까운 역 이름.
 * - 국내: 카카오 로컬 '지하철역' 카테고리 (무료, 카카오 REST 키 = 로그인 앱과 같은 키)
 * - 해외: OpenStreetMap Overpass (무료·키 없음, 사용 정책 한도) — 한국어 이름이 있으면 그것
 * 좌표는 소수 3자리(약 100m)로 반올림해 이 함수 안에서만 쓰고 버린다 — 로그·DB·AI 입력에 넣지 않는다 (CLAUDE.md)
 */
export type Anchor =
  | { type: 'coords'; lat: number; lng: number }
  | { type: 'text'; name: string }
  | { type: 'lodging'; name: string };

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const inKorea = (lat: number, lng: number) => inKoreaBox({ lat, lng });

async function nearestKakao(lat: number, lng: number, kakaoKey: string): Promise<string | null> {
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=${lng}&y=${lat}&radius=3000&sort=distance&size=1`;
  guardApi('kakao_category');
  trackApi('kakao_category');
  const res = await fetch(url, {
    headers: { authorization: `KakaoAK ${kakaoKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { documents?: { place_name?: string }[] };
  // "신도림역 2호선" → "신도림역"
  return body.documents?.[0]?.place_name?.replace(/\s+\S+선$/, '') ?? null;
}

async function nearestOverpass(lat: number, lng: number): Promise<string | null> {
  const query = `[out:json][timeout:10];(node(around:2000,${lat},${lng})[railway=station];node(around:2000,${lat},${lng})[station=subway];);out 10;`;
  guardApi('overpass');
  trackApi('overpass');
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      // 공용 서버 정책: 누가 부르는지 알 수 있게
      'user-agent': 'TripPocket/1.0 (+https://trippocket.day)',
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    elements?: { lat: number; lon: number; tags?: Record<string, string> }[];
  };
  const best = (body.elements ?? [])
    .filter((e) => e.tags?.name)
    .sort((a, b) => Math.hypot(a.lat - lat, a.lon - lng) - Math.hypot(b.lat - lat, b.lon - lng))[0];
  if (!best?.tags) return null;
  const name = best.tags['name:ko'] ?? best.tags.name ?? '';
  // 한국어 이름에 "역"이 없으면 붙인다 (신주쿠 → 신주쿠역)
  return best.tags['name:ko'] && !name.endsWith('역') ? `${name}역` : name;
}

/** 기준점 → 검색에 쓸 이름 ("신주쿠역", "성수동"). 못 찾으면 null */
export async function resolveAnchor(
  anchor: Anchor,
  kakaoKey: string | undefined,
): Promise<string | null> {
  if (anchor.type !== 'coords') return anchor.name.trim().slice(0, 40) || null;
  const lat = round3(anchor.lat);
  const lng = round3(anchor.lng);
  try {
    if (inKorea(lat, lng) && kakaoKey) return await nearestKakao(lat, lng, kakaoKey);
    return await nearestOverpass(lat, lng);
  } catch {
    return null;
  }
}
