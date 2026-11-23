import { guardApi, trackApi } from './apiUsage';

/**
 * 편명으로 항공편 정보 불러오기 — AviationStack 무료 요금제 (사용자 선택 2026-10-24)
 * + 한국공항공사 무료 API(청주·대구·김해 등 지방 공항 출발·도착 편, 사용자 요청 2026-11-23).
 * 무료는 월 100회·최근 운항(실시간) 조회만 → 같은 편명은 보통 매일 같은 시간·공항·터미널이라 그 값을 채워 준다.
 * 미래 날짜 시간표는 유료라 쓰지 않는다. 같은 편명은 7일 저장(서버 메모리) — 사용량 아끼기.
 * 무료 요금제가 HTTPS를 막으면(https_access_restricted) 그 뒤로는 HTTP로 (키가 주소에 실리므로 서버에서만 부른다)
 */
/** 공항 코드·터미널·시각(현지 HH:mm) — 모르는 항목은 비움 */
export interface FlightPoint {
  iata?: string | undefined;
  terminal?: string | undefined;
  time?: string | undefined;
}

export interface FlightInfo {
  flightNo: string;
  airline?: string;
  from: FlightPoint;
  to: FlightPoint;
}

const TTL = 7 * 86_400_000;
const cache = new Map<string, { exp: number; value: FlightInfo | null }>();
let useHttp = false;

/** "2026-10-24T09:10:00+00:00" → "09:10" (AviationStack은 공항 현지 시각을 +00:00으로 표기) */
const hhmm = (iso: unknown) =>
  typeof iso === 'string' && /T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : undefined;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

interface Raw {
  error?: { code?: string };
  data?: {
    flight_date?: string;
    airline?: { name?: string };
    departure?: { iata?: string; terminal?: string; scheduled?: string };
    arrival?: { iata?: string; terminal?: string; scheduled?: string };
  }[];
}

async function call(key: string, flightNo: string): Promise<Raw> {
  const url = `${useHttp ? 'http' : 'https'}://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}&flight_iata=${encodeURIComponent(flightNo)}&limit=10`;
  guardApi('aviationstack');
  trackApi('aviationstack');
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  return (await res.json()) as Raw;
}

/** 한국공항공사(공공데이터포털, 무료) — 청주·대구·김해 등 국내 14개 공항의 오늘 운항. 공항 코드 없이 편명만으로 찾는다 */
interface KacItem {
  airFln?: string;
  airlineKorean?: string;
  io?: string;
  airport?: string;
  city?: string;
  std?: string;
}

async function callKac(key: string, flightNo: string): Promise<FlightInfo | null> {
  guardApi('kac_flights');
  trackApi('kac_flights');
  const url = new URL('https://apis.data.go.kr/B551178/flight-search/info');
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('schFln', flightNo);
  url.searchParams.set('type', 'json');
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`kac ${res.status}`);
  const body = (await res.json()) as {
    response?: { body?: { items?: { item?: KacItem[] | KacItem } } };
  };
  const raw = body.response?.body?.items?.item;
  const items = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
    (x) => str(x.airFln)?.toUpperCase() === flightNo,
  );
  if (!items.length) return null;
  const code = (v: unknown) => (typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? v : undefined);
  const time = (v: unknown) =>
    typeof v === 'string' && /^\d{4}$/.test(v) ? `${v.slice(0, 2)}:${v.slice(2)}` : undefined;
  // 출발 공항 쪽 기록(O)과 도착 공항 쪽 기록(I) — 국내선은 둘 다, 국제선은 한쪽만
  const out = items.find((x) => x.io === 'O');
  const inn = items.find((x) => x.io === 'I');
  const airline = str(items[0]!.airlineKorean);
  return {
    flightNo,
    ...(airline ? { airline } : {}),
    from: clean({
      iata: code(out?.airport) ?? code(inn?.city),
      time: time(out?.std),
    }),
    to: clean({
      iata: code(inn?.airport) ?? code(out?.city),
      time: time(inn?.std),
    }),
  };
}

/** AviationStack 값에 한국공항공사 값을 합친다 — 항공사 이름은 한국어(공사)를, 빈 칸은 서로 채운다 */
function merge(a: FlightInfo | null, k: FlightInfo | null): FlightInfo | null {
  if (!a || !k) return a ?? k;
  // 공항이 다르면 다른 운항으로 보고 AviationStack 값만
  if (a.from.iata && k.from.iata && a.from.iata !== k.from.iata) return a;
  return {
    flightNo: a.flightNo,
    ...((k.airline ?? a.airline) ? { airline: (k.airline ?? a.airline)! } : {}),
    from: { ...k.from, ...a.from },
    to: { ...k.to, ...a.to },
  };
}

async function aviationstack(key: string, code: string): Promise<FlightInfo | null> {
  let raw = await call(key, code);
  if (raw.error?.code === 'https_access_restricted' && !useHttp) {
    useHttp = true;
    raw = await call(key, code);
  }
  if (raw.error) throw new Error(`aviationstack ${raw.error.code ?? 'error'}`);
  // 가장 최근 운항 하나
  const f = [...(raw.data ?? [])].sort((a, b) =>
    (b.flight_date ?? '').localeCompare(a.flight_date ?? ''),
  )[0];
  return f
    ? {
        flightNo: code,
        ...(str(f.airline?.name) ? { airline: str(f.airline?.name)! } : {}),
        from: clean({
          iata: str(f.departure?.iata),
          terminal: str(f.departure?.terminal),
          time: hhmm(f.departure?.scheduled),
        }),
        to: clean({
          iata: str(f.arrival?.iata),
          terminal: str(f.arrival?.terminal),
          time: hhmm(f.arrival?.scheduled),
        }),
      }
    : null;
}

/** 못 찾은 결과는 짧게만 저장 — 오늘 안 뜨는 편도 내일은 찾을 수 있게 (예전엔 7일 동안 "없음"이 남았다) */
const MISS_TTL = 30 * 60_000;

export async function lookupFlight(
  keys: { aviationstack?: string | undefined; kac?: string | undefined },
  flightNo: string,
): Promise<FlightInfo | null> {
  const code = flightNo.replace(/\s+/g, '').toUpperCase();
  const hit = cache.get(code);
  if (hit && hit.exp > Date.now()) return hit.value;
  // 둘 다 부른다: 공사 API는 무료 하루 5,000회라 부담 없고, 지방 공항 편·한국어 항공사 이름을 채운다
  const [a, k] = await Promise.allSettled([
    keys.aviationstack ? aviationstack(keys.aviationstack, code) : Promise.resolve(null),
    keys.kac ? callKac(keys.kac, code) : Promise.resolve(null),
  ]);
  const kac = k.status === 'fulfilled' ? k.value : null;
  // AviationStack이 멈춤·오류여도 공사 값이 있으면 그것으로
  if (a.status === 'rejected' && !kac) throw a.reason;
  const value = merge(a.status === 'fulfilled' ? a.value : null, kac);
  cache.set(code, { exp: Date.now() + (value ? TTL : MISS_TTL), value });
  // 메모리가 계속 늘지 않게
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return value;
}

const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** 시험용 */
export const resetFlightCache = () => {
  cache.clear();
  useHttp = false;
};
