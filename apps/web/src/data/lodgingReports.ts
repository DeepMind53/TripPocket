import type { LodgingReportInput, LodgingReportView } from '@trippocket/shared';
import { lodgingApi, type ReportQuery } from './api/lodging';

/**
 * 숙소 가격 기록 요청 방어 (docs/28 §8.1, 필수): 무한 요청이 생기지 않게
 * - 사용자가 누를 때만 부른다 (화면의 useEffect에서 부르지 않는다)
 * - 종류마다 진행 중 요청은 1개 — 그동안 다시 부르면 같은 결과를 기다린다
 * - 같은 조건 목록은 5분 재사용, 자동 재시도 없음, 시간 제한 10초, 화면을 닫으면 취소
 * - 1분에 5번 넘게 부르면 1분 쉰다 (서버 한도와 별도로 앞에서 막기)
 * - 서버가 429를 주면 그 시간 동안 부르지 않는다
 */
export type ReportsResult =
  | { ok: true; reports: LodgingReportView[] }
  | { ok: false; reason: 'offline' | 'error' | 'busy' | 'limit' | 'daily' | 'range' };

const TIMEOUT_MS = 10_000;
const CACHE_MS = 5 * 60_000;
const BURST = { max: 5, windowMs: 60_000 };

const cache = new Map<string, { at: number; reports: LodgingReportView[] }>();
const inflight = new Map<string, Promise<ReportsResult>>();
const calls: number[] = [];
let blockedUntil = 0;

const keyOf = (q: ReportQuery) =>
  [q.hotelKey, q.altKey ?? '', q.checkIn, q.nights, q.adults].join('|');

/** 연타 막기 + 서버가 쉬라고 한 시간 */
function allowed(now: number): boolean {
  if (now < blockedUntil) return false;
  while (calls.length && now - calls[0]! > BURST.windowMs) calls.shift();
  if (calls.length >= BURST.max) return false;
  calls.push(now);
  return true;
}

/** 시간 제한 + 바깥 취소를 한 신호로 */
function withTimeout(outer?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  outer?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onAbort);
    },
  };
}

const failOf = (status: number, reason: string): ReportsResult => {
  if (status === 429) {
    blockedUntil = Date.now() + BURST.windowMs;
    return { ok: false, reason: 'limit' };
  }
  return { ok: false, reason: reason === 'offline' ? 'offline' : 'error' };
};

export async function loadReports(q: ReportQuery, outer?: AbortSignal): Promise<ReportsResult> {
  const key = keyOf(q);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ok: true, reports: hit.reports };
  const running = inflight.get(key);
  if (running) return running;
  if (!allowed(Date.now())) return { ok: false, reason: 'busy' };
  const run = (async (): Promise<ReportsResult> => {
    const t = withTimeout(outer);
    try {
      const res = await lodgingApi.list(q, t.signal);
      if (!res.ok) return failOf(res.status, res.reason);
      // 모양이 다른 응답은 실패로 (다시 부르지 않는다)
      if (!Array.isArray(res.data?.reports)) return { ok: false, reason: 'error' };
      cache.set(key, { at: Date.now(), reports: res.data.reports });
      return { ok: true, reports: res.data.reports };
    } catch {
      return { ok: false, reason: 'error' };
    } finally {
      t.done();
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

let saving: Promise<ReportsResult> | null = null;

/** 적기 — 저장 중에는 새로 보내지 않는다. 성공하면 그 숙소 목록 캐시에 바로 더한다 (다시 불러오지 않음) */
export function saveReport(input: LodgingReportInput, q: ReportQuery): Promise<ReportsResult> {
  if (saving) return saving;
  if (!allowed(Date.now())) return Promise.resolve({ ok: false, reason: 'busy' });
  saving = (async (): Promise<ReportsResult> => {
    const t = withTimeout();
    try {
      const res = await lodgingApi.save(input, t.signal);
      if (!res.ok) {
        if (res.status === 422) return { ok: false, reason: 'range' };
        if (res.status === 429 && res.reason !== 'limit') return { ok: false, reason: 'daily' };
        return failOf(res.status, res.reason);
      }
      if (!res.data?.report?.id) return { ok: false, reason: 'error' };
      const key = keyOf(q);
      const prev = cache.get(key)?.reports ?? [];
      const reports = [res.data.report, ...prev.filter((r) => r.id !== res.data.report.id)];
      cache.set(key, { at: Date.now(), reports });
      return { ok: true, reports };
    } catch {
      return { ok: false, reason: 'error' };
    } finally {
      t.done();
      saving = null;
    }
  })();
  return saving;
}

export async function removeReport(id: string, q: ReportQuery): Promise<ReportsResult> {
  if (!allowed(Date.now())) return { ok: false, reason: 'busy' };
  const t = withTimeout();
  try {
    const res = await lodgingApi.remove(id, t.signal);
    if (!res.ok) return failOf(res.status, res.reason);
    const key = keyOf(q);
    const reports = (cache.get(key)?.reports ?? []).filter((r) => r.id !== id);
    cache.set(key, { at: Date.now(), reports });
    return { ok: true, reports };
  } catch {
    return { ok: false, reason: 'error' };
  } finally {
    t.done();
  }
}

/** 테스트용: 캐시·한도 초기화 */
export function resetReportGuards(): void {
  cache.clear();
  inflight.clear();
  calls.length = 0;
  blockedUntil = 0;
  saving = null;
}
