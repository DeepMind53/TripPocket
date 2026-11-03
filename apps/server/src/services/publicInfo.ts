import { guardApi, trackApi, type ApiId } from './apiUsage';

/**
 * 무료 API 2·3단계 (docs/26, 사용자 결정 2026-11-03) — 공공데이터포털 4종 + AirLabs.
 * - 외교부 입국허가요건 (EntranceVisaService2) → 관리자 점검: 앱의 무비자 기간과 공식 값 비교
 * - 외교부 안전공지 (CountrySafetyService7) → 여행지 특보 카드에 최신 공지
 * - 한국관광공사 행사정보 (KorService2 searchFestival2) → 국내 여행 기간 축제·행사
 * - 에어코리아 시도별 실시간 (ArpltnInforInqireSvc) → 국내 여행 오늘 미세먼지
 * - AirLabs (flight) → 출발 당일 항공편 지연
 * 공공데이터포털은 서비스마다 활용신청이 필요하다 — 신청 전에는 "등록되지 않은 서비스키"(403) → 기능만 조용히 빈다.
 * 보내는 것은 나라 코드·시도 이름·여행지 도시 좌표·편명뿐 (사용자 정보·내 위치 없음). 받은 값은 서버 메모리에만 잠깐
 */
const DATA = 'https://apis.data.go.kr';
const timeout = () => AbortSignal.timeout(8000);

/** 공공데이터포털 응답에서 목록 꺼내기 (response.body.items.item · items 배열 · data 세 모양) */
export function dataItems(raw: unknown): Record<string, unknown>[] {
  const r = raw as {
    response?: {
      header?: { resultCode?: string };
      body?: { items?: unknown };
    };
    data?: unknown;
  };
  const code = r.response?.header?.resultCode;
  // 정상 코드는 서비스마다 다르다 (한국관광공사는 '0000', 2026-11-03 실제 응답으로 확인)
  if (code && !/^0+$/.test(code) && code !== 'INFO-000') throw new Error(`data.go.kr ${code}`);
  const items = r.response?.body?.items ?? r.data;
  const list = Array.isArray(items)
    ? items
    : items && typeof items === 'object' && 'item' in items
      ? (items as { item: unknown }).item
      : [];
  return (Array.isArray(list) ? list : list ? [list] : []) as Record<string, unknown>[];
}

const str = (v: unknown) =>
  typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';

async function getJson(id: ApiId, url: string): Promise<unknown> {
  guardApi(id);
  trackApi(id);
  const res = await fetch(url, { signal: timeout() });
  if (!res.ok) throw new Error(`${id} ${res.status}`);
  return res.json();
}

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const value = await load();
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}
export const resetPublicInfoCache = () => cache.clear();

const HOUR = 3_600_000;

// ── 외교부 입국허가요건 ──
export interface EntryVisa {
  /** 일반여권 무비자 입국 가능 여부·기간 원문 (예: "90일") */
  allowed: string;
  period: string;
  basis: string;
}
export function entryVisa(cc: string, key: string): Promise<EntryVisa | null> {
  return cached(`visa:${cc}`, 7 * 24 * HOUR, async () => {
    const q = `serviceKey=${encodeURIComponent(key)}&returnType=JSON&numOfRows=5&pageNo=1&cond[country_iso_alp2::EQ]=${cc}`;
    const it = dataItems(
      await getJson('mofa_entry', `${DATA}/1262000/EntranceVisaService2/getEntranceVisaList2?${q}`),
    )[0];
    if (!it) return null;
    return {
      allowed: str(it.gnrl_pspt_visa_yn),
      period: str(it.gnrl_pspt_visa_cn),
      basis: str(it.nvisa_entry_evdc_cn),
    };
  });
}

/** "90일" · "3개월" → 일 수 (모르면 null) */
export function periodDays(text: string): number | null {
  const d = /(\d+)\s*일/.exec(text);
  if (d) return Number(d[1]);
  const m = /(\d+)\s*개월/.exec(text);
  return m ? Number(m[1]) * 30 : null;
}

// ── 외교부 안전공지 ──
export interface SafetyNotice {
  title: string;
  date: string;
  url?: string;
}
export function safetyNotices(cc: string, key: string): Promise<SafetyNotice[]> {
  return cached(`safety:${cc}`, 6 * HOUR, async () => {
    const q = `serviceKey=${encodeURIComponent(key)}&returnType=JSON&numOfRows=5&pageNo=1&cond[country_iso_alp2::EQ]=${cc}`;
    const list = dataItems(
      await getJson(
        'mofa_safety',
        `${DATA}/1262000/CountrySafetyService7/getCountrySafetyList7?${q}`,
      ),
    );
    return list
      .map((i) => ({
        title: str(i.title).slice(0, 120),
        date: str(i.wrt_dt ?? i.written_dt ?? i.regDt).slice(0, 10),
        ...(str(i.file_download_url ?? i.url).startsWith('https://')
          ? { url: str(i.file_download_url ?? i.url) }
          : {}),
      }))
      .filter((n) => n.title)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
  });
}

// ── 한국관광공사 축제·행사 ──
export interface Festival {
  id: string;
  title: string;
  address: string;
  start: string;
  end: string;
  coords: { lat: number; lng: number };
  image?: string;
}
const ymd = (d: string) => d.replace(/-/g, '');
const dashed = (d: string) =>
  /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d;
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
};
/** 여행 기간(from~to)에 열리는, 여행지 좌표 30km 안의 행사 (가까운 순, 최대 10) */
export async function festivalsNear(
  near: { lat: number; lng: number },
  from: string,
  to: string,
  key: string,
): Promise<Festival[]> {
  // 같은 출발일은 전국 목록을 하루 한 번만 받는다 (좌표별로 거름)
  const all = await cached(`fest:${from}`, 24 * HOUR, async () => {
    const q = `serviceKey=${encodeURIComponent(key)}&_type=json&MobileOS=ETC&MobileApp=TripPocket&numOfRows=500&pageNo=1&arrange=A&eventStartDate=${ymd(from)}`;
    return dataItems(await getJson('tourapi', `${DATA}/B551011/KorService2/searchFestival2?${q}`));
  });
  return all
    .map((i) => {
      const lat = Number(i.mapy);
      const lng = Number(i.mapx);
      const image = str(i.firstimage2 ?? i.firstimage);
      return {
        id: str(i.contentid),
        title: str(i.title).slice(0, 100),
        address: str(i.addr1).slice(0, 200),
        start: dashed(str(i.eventstartdate)),
        end: dashed(str(i.eventenddate)),
        coords: { lat, lng },
        ...(image.startsWith('https://') || image.startsWith('http://')
          ? { image: image.replace(/^http:/, 'https:') }
          : {}),
      };
    })
    .filter(
      (f) =>
        f.title &&
        Number.isFinite(f.coords.lat) &&
        f.coords.lat !== 0 &&
        f.start <= to &&
        f.end >= from &&
        km(near, f.coords) <= 30,
    )
    .sort((a, b) => km(near, a.coords) - km(near, b.coords))
    .slice(0, 10);
}

// ── 에어코리아 (국내 오늘 미세먼지) ──
export const SIDO = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
] as const;
/** 시도 안 측정소 PM2.5 평균 (측정값 있는 곳만) */
export function airKoreaPm25(
  sido: string,
  key: string,
): Promise<{ pm25: number; at: string } | null> {
  return cached(`air:${sido}`, HOUR, async () => {
    const q = `serviceKey=${encodeURIComponent(key)}&returnType=json&numOfRows=200&pageNo=1&ver=1.0&sidoName=${encodeURIComponent(sido)}`;
    const list = dataItems(
      await getJson(
        'airkorea',
        `${DATA}/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?${q}`,
      ),
    );
    const vals = list.map((i) => Number(i.pm25Value)).filter((v) => Number.isFinite(v) && v >= 0);
    if (!vals.length) return null;
    return {
      pm25: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      at: str(list[0]?.dataTime),
    };
  });
}

// ── AirLabs (출발 당일 지연) ──
export interface FlightStatus {
  status: string;
  depDelay?: number;
  arrDelay?: number;
}
export function airlabsStatus(flightNo: string, key: string): Promise<FlightStatus | null> {
  return cached(`airlabs:${flightNo}`, 10 * 60_000, async () => {
    const body = (await getJson(
      'airlabs',
      `https://airlabs.co/api/v9/flight?flight_iata=${encodeURIComponent(flightNo)}&api_key=${encodeURIComponent(key)}`,
    )) as { response?: Record<string, unknown>; error?: unknown };
    const r = body.response;
    if (!r || body.error) return null;
    const n = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined);
    const depDelay = n(r.dep_delayed);
    const arrDelay = n(r.arr_delayed);
    return {
      status: str(r.status),
      ...(depDelay ? { depDelay } : {}),
      ...(arrDelay ? { arrDelay } : {}),
    };
  });
}
