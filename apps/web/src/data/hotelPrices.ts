import type { HotelPricesView } from '@trippocket/shared';
import { api } from './api/client';

/**
 * 구글 호텔 참고 가격 (서버 /api/lodging/prices, docs/28 §4.3·§8.1). 요청 방어:
 * 누를 때만 · 같은 조건 진행 중 1개 · 같은 조건 6시간 재사용 · 25초 · 자동 재시도 없음 · 1분 5번까지
 */
export interface PriceStay {
  name: string;
  checkIn: string;
  checkOut: string;
  adults: number;
}

export type PricesResult =
  | { ok: true; hotel: HotelPricesView | null }
  | { ok: false; reason: 'offline' | 'error' | 'busy' | 'paused' | 'quota' | 'daily' | 'off' };

const TIMEOUT_MS = 25_000;
const TTL = 6 * 3_600_000;
const cache = new Map<string, { at: number; hotel: HotelPricesView | null }>();
const inflight = new Map<string, Promise<PricesResult>>();
const calls: number[] = [];
let blockedUntil = 0;

const keyOf = (s: PriceStay) =>
  [
    s.name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '),
    s.checkIn,
    s.checkOut,
    s.adults,
  ].join('|');

const valid = (h: unknown): h is HotelPricesView => {
  const v = h as HotelPricesView | null;
  return (
    !!v &&
    typeof v.name === 'string' &&
    Array.isArray(v.prices) &&
    v.prices.every((p) => typeof p?.source === 'string' && Number.isInteger(p.nightlyKrw))
  );
};

export function loadHotelPrices(stay: PriceStay, outer?: AbortSignal): Promise<PricesResult> {
  const key = keyOf(stay);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL) return Promise.resolve({ ok: true, hotel: hit.hotel });
  const running = inflight.get(key);
  if (running) return running;
  while (calls.length && now - calls[0]! > 60_000) calls.shift();
  if (now < blockedUntil || calls.length >= 5)
    return Promise.resolve({ ok: false, reason: 'busy' });
  calls.push(now);
  const run = (async (): Promise<PricesResult> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    outer?.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await api<{ hotel?: unknown }>(
        `/api/lodging/prices?${new URLSearchParams({
          name: stay.name.trim(),
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          adults: String(stay.adults),
        })}`,
        { signal: ctrl.signal },
      );
      if (!res.ok) {
        if (res.status === 429) {
          blockedUntil = Date.now() + 60_000;
          return { ok: false, reason: 'daily' };
        }
        if (res.code === 'prices_quota') return { ok: false, reason: 'quota' };
        if (res.code === 'prices_off') return { ok: false, reason: 'off' };
        if (res.code === 'prices_paused' || res.code === 'busy')
          return { ok: false, reason: 'paused' };
        if (res.code === 'prices_failed') return { ok: false, reason: 'error' };
        return { ok: false, reason: res.reason === 'offline' ? 'offline' : 'error' };
      }
      const hotel = res.data.hotel;
      if (hotel !== null && !valid(hotel)) return { ok: false, reason: 'error' };
      cache.set(key, { at: Date.now(), hotel });
      return { ok: true, hotel };
    } catch {
      return { ok: false, reason: 'error' };
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onAbort);
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

/** 테스트용 */
export function resetHotelPrices(): void {
  cache.clear();
  inflight.clear();
  calls.length = 0;
  blockedUntil = 0;
}
