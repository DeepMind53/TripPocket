import { api } from './api/client';

/**
 * 아고다 숙소 자동 찾기 (서버 /api/lodging/lookup, docs/28 §4.2). 요청 방어는 기록 목록과 같은 규칙:
 * 누를 때만 · 같은 이름 진행 중 1개 · 이번 실행 동안 같은 이름 재사용 · 10초 · 자동 재시도 없음 · 1분 5번까지
 */
export interface AgodaCandidate {
  hid: number;
  name: string;
  city?: string;
}

export type LookupResult =
  | { ok: true; candidates: AgodaCandidate[] }
  | { ok: false; reason: 'offline' | 'error' | 'busy' | 'paused' | 'daily' };

const TIMEOUT_MS = 10_000;
const cache = new Map<string, AgodaCandidate[]>();
const inflight = new Map<string, Promise<LookupResult>>();
const calls: number[] = [];
let blockedUntil = 0;

const keyOf = (name: string) => name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

export function lookupAgoda(name: string, outer?: AbortSignal): Promise<LookupResult> {
  const key = keyOf(name);
  const hit = cache.get(key);
  if (hit) return Promise.resolve({ ok: true, candidates: hit });
  const running = inflight.get(key);
  if (running) return running;
  const now = Date.now();
  while (calls.length && now - calls[0]! > 60_000) calls.shift();
  if (now < blockedUntil || calls.length >= 5)
    return Promise.resolve({ ok: false, reason: 'busy' });
  calls.push(now);
  const run = (async (): Promise<LookupResult> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    outer?.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await api<{ candidates?: unknown }>(
        `/api/lodging/lookup?${new URLSearchParams({ name: name.trim() })}`,
        { signal: ctrl.signal },
      );
      if (!res.ok) {
        if (res.status === 429) {
          blockedUntil = Date.now() + 60_000;
          return { ok: false, reason: 'daily' };
        }
        if (res.status === 503) return { ok: false, reason: 'paused' };
        return { ok: false, reason: res.reason === 'offline' ? 'offline' : 'error' };
      }
      const list = res.data.candidates;
      if (!Array.isArray(list)) return { ok: false, reason: 'error' };
      const candidates = (list as AgodaCandidate[]).filter(
        (c) => Number.isInteger(c?.hid) && c.hid > 0 && typeof c.name === 'string',
      );
      cache.set(key, candidates);
      return { ok: true, candidates };
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
export function resetAgodaLookup(): void {
  cache.clear();
  inflight.clear();
  calls.length = 0;
  blockedUntil = 0;
}
