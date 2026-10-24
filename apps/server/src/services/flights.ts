import { guardApi, trackApi } from './apiUsage';

/**
 * 편명으로 항공편 정보 불러오기 — AviationStack 무료 요금제 (사용자 선택 2026-10-24).
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

export async function lookupFlight(key: string, flightNo: string): Promise<FlightInfo | null> {
  const code = flightNo.replace(/\s+/g, '').toUpperCase();
  const hit = cache.get(code);
  if (hit && hit.exp > Date.now()) return hit.value;
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
  const value: FlightInfo | null = f
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
  cache.set(code, { exp: Date.now() + TTL, value });
  // 메모리가 계속 늘지 않게 (월 100회라 거의 닿지 않음)
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
