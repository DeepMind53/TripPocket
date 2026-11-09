import { HOTEL_PRICE_RULES, type HotelPriceView, type HotelPricesView } from '@trippocket/shared';
import { ApiPaused, guardApi, trackApi } from './apiUsage';

/**
 * 구글 호텔 참고 가격 (docs/28 §4.3 B, ADR-0010): SerpApi `google_hotels`로 예약처별 가격을 읽는다.
 * 보내는 것은 숙소 이름·날짜·인원·통화뿐. 결과는 서버 메모리에 6시간만 두고 저장하지 않는다.
 * - 검색 1번에 SerpApi 최대 2번: 이름이 숙소 하나로 맞으면 1번, 목록이 오면 첫 호텔의 property_token으로 1번 더
 * - 월 무료 250회는 apiUsage(serpapi_hotels)가 95%에서 멈추고, 서버 전체 시간당 40회로 따로 막는다 (SerpApi 시간당 상한 아래)
 * - 차단기: 연속 실패 3번 → 30분, 401·403·429(무료량 끝 제외) → 24시간, 일주일에 3번 → 서버를 다시 켤 때까지 끔
 * - SerpApi가 "이번 달 검색을 다 썼다"고 하면 24시간 멈추고 무료량 끝으로 알린다
 * 실제 응답 모양 확인: docs/28 §12.1 (2026-11-09)
 */
export interface PriceQuery {
  name: string;
  checkIn: string;
  checkOut: string;
  adults: number;
}

const TTL = 6 * 3_600_000;
const MAX = 300;
const TIMEOUT_MS = 12_000;
/** 검색 1번 전체 마감 (docs/28 §8.2) */
const DEADLINE_MS = 20_000;
const MAX_BYTES = 3_000_000;
const HOURLY = 40;
const ENDPOINT = 'https://serpapi.com/search.json';

const cache = new Map<string, { at: number; value: HotelPricesView | null }>();
const inflight = new Map<string, Promise<HotelPricesView | null>>();
const breaker = {
  fails: 0,
  pausedUntil: 0,
  blocks: [] as number[],
  off: false,
  quotaUntil: 0,
};
let hour: number[] = [];

/** 멈춘 상태 — SerpApi에 묻지 않고 바로 알린다 (quota = 무료량 끝) */
export class PricesPaused extends Error {
  constructor(readonly quota: boolean) {
    super(quota ? 'serpapi_quota' : 'serpapi_paused');
  }
}

class Blocked extends Error {}
class Quota extends Error {}

export function pricesState(now = Date.now()) {
  return {
    paused: breaker.off || now < breaker.pausedUntil || now < breaker.quotaUntil,
    quota: now < breaker.quotaUntil,
    off: breaker.off,
    until: Math.max(breaker.pausedUntil, breaker.quotaUntil),
  };
}

function onBlocked(now: number): void {
  breaker.blocks = [...breaker.blocks.filter((t) => now - t < 7 * 86_400_000), now];
  breaker.pausedUntil = now + 86_400_000;
  if (breaker.blocks.length >= 3) breaker.off = true;
}

function onFailed(now: number): void {
  breaker.fails += 1;
  if (breaker.fails >= 3) {
    breaker.pausedUntil = now + 30 * 60_000;
    breaker.fails = 0;
  }
}

const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
const lowest = (r: unknown) => {
  const o = r as { extracted_lowest?: unknown; extracted_display_price?: unknown } | undefined;
  return num(o?.extracted_lowest) ?? num(o?.extracted_display_price);
};

/** 예약처별 가격 → 예약처마다 가장 싼 1줄, 1박 오름차순, 최대 12줄 */
function readPrices(list: unknown[]): HotelPriceView[] {
  const best = new Map<string, HotelPriceView>();
  for (const p of list as Record<string, unknown>[]) {
    const source = typeof p?.source === 'string' ? p.source.trim().slice(0, 60) : '';
    const nightlyKrw = lowest(p?.rate_per_night);
    if (!source || !nightlyKrw) continue;
    const totalKrw = lowest(p.total_rate);
    const prev = best.get(source);
    if (prev && prev.nightlyKrw <= nightlyKrw) continue;
    best.set(source, {
      source,
      nightlyKrw,
      ...(totalKrw ? { totalKrw } : {}),
      ...(p.official === true ? { official: true as const } : {}),
    });
  }
  return [...best.values()]
    .sort((a, b) => a.nightlyKrw - b.nightlyKrw)
    .slice(0, HOTEL_PRICE_RULES.maxRows);
}

/**
 * SerpApi 응답 읽기: 숙소 하나 → 가격 / 목록 → 첫 호텔의 token / 결과 없음 → null.
 * 모양이 다르면 실패 (빈 결과로 넘기지 않는다)
 */
export function parseHotels(body: unknown): { view: HotelPricesView } | { token: string } | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') throw new Error('serpapi_shape');
  if (typeof b.error === 'string') {
    if (/run out of searches/i.test(b.error)) throw new Quota(b.error);
    if (/hasn.t returned any results/i.test(b.error)) return null;
    throw new Error('serpapi_error');
  }
  if (Array.isArray(b.prices) || b.type === 'hotel' || b.type === 'vacation rental') {
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 120) : '';
    if (!name) throw new Error('serpapi_shape');
    return { view: { name, prices: readPrices(Array.isArray(b.prices) ? b.prices : []) } };
  }
  if (Array.isArray(b.properties)) {
    const first = (b.properties as Record<string, unknown>[]).find(
      (p) => p?.type === 'hotel' && typeof p.property_token === 'string' && p.property_token,
    );
    return first ? { token: first.property_token as string } : null;
  }
  throw new Error('serpapi_shape');
}

async function call(
  key: string,
  q: PriceQuery,
  signal: AbortSignal,
  token?: string,
): Promise<ReturnType<typeof parseHotels>> {
  const now = Date.now();
  hour = hour.filter((t) => now - t < 3_600_000);
  if (hour.length >= HOURLY) throw new PricesPaused(false);
  guardApi('serpapi_hotels');
  hour.push(now);
  trackApi('serpapi_hotels');
  const params = new URLSearchParams({
    engine: 'google_hotels',
    q: q.name,
    check_in_date: q.checkIn,
    check_out_date: q.checkOut,
    adults: String(q.adults),
    currency: 'KRW',
    gl: 'kr',
    hl: 'ko',
    ...(token ? { property_token: token } : {}),
    api_key: key,
  });
  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('serpapi too large');
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // 아래에서 상태 코드로 판단
  }
  const err = (body as { error?: unknown } | null)?.error;
  if (typeof err === 'string' && /run out of searches/i.test(err)) throw new Quota(err);
  if (res.status === 401 || res.status === 403 || res.status === 429)
    throw new Blocked(`serpapi ${res.status}`);
  if (!res.ok && typeof err !== 'string') throw new Error(`serpapi ${res.status}`);
  return parseHotels(body);
}

async function ask(key: string, q: PriceQuery): Promise<HotelPricesView | null> {
  const signal = AbortSignal.timeout(DEADLINE_MS);
  const first = await call(key, q, signal);
  if (!first || 'view' in first) return first?.view ?? null;
  const second = await call(key, q, signal, first.token);
  return second && 'view' in second ? second.view : null;
}

export async function hotelPrices(
  key: string,
  q: PriceQuery,
  now = Date.now(),
): Promise<HotelPricesView | null> {
  const id = [
    q.name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '),
    q.checkIn,
    q.checkOut,
    q.adults,
  ].join('|');
  const hit = cache.get(id);
  if (hit && now - hit.at < TTL) return hit.value;
  const state = pricesState(now);
  if (state.paused) throw new PricesPaused(state.quota);
  const running = inflight.get(id);
  if (running) return running;
  const run = (async () => {
    try {
      const value = await ask(key, { ...q, name: q.name.trim() });
      breaker.fails = 0;
      if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
      cache.set(id, { at: Date.now(), value });
      return value;
    } catch (e) {
      const t = Date.now();
      if (e instanceof Quota) {
        breaker.quotaUntil = t + 86_400_000;
        throw new PricesPaused(true);
      }
      if (e instanceof Blocked) onBlocked(t);
      // 우리 쪽 상한(ApiPaused·시간당)은 SerpApi 실패가 아니다
      else if (!(e instanceof PricesPaused) && !(e instanceof ApiPaused)) onFailed(t);
      throw e;
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, run);
  return run;
}

/** 관리자: 차단기만 풀기 (캐시·시간당 횟수는 그대로). SerpApi 무료량 끝 표시도 푼다 */
export function resumeHotelPrices(): void {
  Object.assign(breaker, { fails: 0, pausedUntil: 0, blocks: [], off: false, quotaUntil: 0 });
}

/** 관리자 화면용: 서버가 기억하는 조건 수, 최근 1시간 호출 수 */
export const hotelPricesStats = (now = Date.now()) => ({
  cacheSize: cache.size,
  lastHour: hour.filter((t) => now - t < 3_600_000).length,
  hourly: HOURLY,
});

/** 시험용 */
export function resetHotelPrices(): void {
  cache.clear();
  inflight.clear();
  hour = [];
  Object.assign(breaker, { fails: 0, pausedUntil: 0, blocks: [], off: false, quotaUntil: 0 });
}
