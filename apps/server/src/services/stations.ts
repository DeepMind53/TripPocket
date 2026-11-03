import { guardApi, trackApi } from './apiUsage';

/**
 * 해외 역·터미널 찾기 (예약 → 기차·버스 출발/도착역, 사용자 요청 2026-11-03):
 * 도시 이름 → (Geoapify 지오코딩, 도시만) 중심 좌표 → (Geoapify Places) 반경 안 기차역·지하철역·버스 터미널.
 * 무료 하루 3,000 크레딧(장소 20곳 = 1) 안. 보내는 것은 도시 이름·나라 코드·도시 중심 좌표뿐 (내 위치 아님).
 * 같은 도시·종류는 7일 동안 서버 메모리에 두고 다시 묻지 않는다
 */
export interface Station {
  name: string;
  /** 현지어·영어 이름 (한국어 이름과 다를 때) */
  local?: string;
  address: string;
  coords: { lat: number; lng: number };
}

export type StationKind = 'train' | 'subway' | 'bus';
const CATEGORIES: Record<StationKind, string> = {
  train: 'public_transport.train',
  subway: 'public_transport.subway,public_transport.light_rail,public_transport.monorail',
  bus: 'public_transport.bus',
};

const TTL = 7 * 86_400_000;
const TERMINAL = /terminal|station|bus\s*stand|터미널|역|驛|駅|站|ターミナル|bến xe|terminal bas/i;
const cache = new Map<string, { at: number; value: Station[] }>();
const timeout = () => AbortSignal.timeout(8000);

/** 도시 이름 → 중심 좌표 (도시만, 그 나라 안) */
async function cityCenter(
  city: string,
  cc: string | undefined,
  key: string,
): Promise<{ lat: number; lng: number } | null> {
  guardApi('geoapify');
  trackApi('geoapify');
  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.set('text', city);
  url.searchParams.set('type', 'city');
  url.searchParams.set('limit', '1');
  url.searchParams.set('format', 'json');
  if (cc) url.searchParams.set('filter', `countrycode:${cc.toLowerCase()}`);
  url.searchParams.set('apiKey', key);
  const res = await fetch(url, { signal: timeout() });
  if (!res.ok) throw new Error(`geoapify ${res.status}`);
  const r = ((await res.json()) as { results?: { lat?: number; lon?: number }[] }).results?.[0];
  return typeof r?.lat === 'number' && typeof r.lon === 'number'
    ? { lat: r.lat, lng: r.lon }
    : null;
}

export async function findStations(
  opts: {
    city?: string | undefined;
    cc?: string | undefined;
    near?: { lat: number; lng: number } | undefined;
    kind: StationKind;
  },
  key: string,
): Promise<Station[]> {
  const cacheKey = `${opts.kind}|${opts.cc ?? ''}|${opts.city?.trim().toLowerCase() ?? ''}|${opts.near ? `${opts.near.lat.toFixed(2)},${opts.near.lng.toFixed(2)}` : ''}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const center = opts.city?.trim() ? await cityCenter(opts.city.trim(), opts.cc, key) : opts.near;
  if (!center) return [];
  guardApi('geoapify');
  trackApi('geoapify', 2);
  const url = new URL('https://api.geoapify.com/v2/places');
  url.searchParams.set('categories', CATEGORIES[opts.kind]);
  url.searchParams.set('filter', `circle:${center.lng},${center.lat},15000`);
  url.searchParams.set('bias', `proximity:${center.lng},${center.lat}`);
  url.searchParams.set('limit', '40');
  url.searchParams.set('lang', 'ko');
  url.searchParams.set('apiKey', key);
  const res = await fetch(url, { signal: timeout() });
  if (!res.ok) throw new Error(`geoapify ${res.status}`);
  const body = (await res.json()) as {
    features?: {
      properties?: {
        name?: string;
        name_international?: Record<string, string>;
        formatted?: string;
        address_line2?: string;
        lat?: number;
        lon?: number;
      };
    }[];
  };
  const seen = new Set<string>();
  const out: Station[] = [];
  for (const f of body.features ?? []) {
    const p = f.properties;
    if (!p?.name || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    // 같은 역의 출입구·승강장이 여러 개로 오면 이름 하나만
    if (seen.has(p.name)) continue;
    seen.add(p.name);
    const en = p.name_international?.en;
    out.push({
      name: p.name.slice(0, 100),
      ...(en && en !== p.name ? { local: en.slice(0, 100) } : {}),
      address: (p.address_line2 ?? p.formatted ?? '').slice(0, 200),
      coords: { lat: p.lat, lng: p.lon },
    });
  }
  // 버스는 정류장이 아주 많다 → 터미널·역 이름이 있으면 그것만 (없으면 그대로)
  const result =
    opts.kind === 'bus' && out.some((x) => TERMINAL.test(x.name) || TERMINAL.test(x.local ?? ''))
      ? out.filter((x) => TERMINAL.test(x.name) || TERMINAL.test(x.local ?? ''))
      : out;
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { at: Date.now(), value: result });
  return result;
}

/** 시험용 */
export const resetStationCache = () => cache.clear();
