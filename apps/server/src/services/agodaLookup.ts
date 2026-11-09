import { ApiPaused, guardApi, trackApi } from './apiUsage';

/**
 * 아고다 숙소 자동 찾기 (docs/28 §4.2·§8, ADR-0010): 숙소 이름으로 아고다 숙소 검색(자동완성)을 1번 불러 숙소 id를 찾는다.
 * 보내는 것은 숙소 이름뿐. 정직한 요청만 (위장·우회 없음) — 막히면 멈춘다.
 * - 같은 이름은 30일 동안 서버 메모리에 두고 다시 묻지 않는다, 같은 이름 동시 요청은 하나로 합친다
 * - 하루 상한은 apiUsage(agoda_lookup)가, 사람별 한도·동시 실행은 routes/lodging.ts가 맡는다
 * - 차단기: 연속 실패 3번 → 30분 중지, 차단 신호(403·429·JSON 아님·리다이렉트) → 24시간 중지,
 *   일주일에 차단 신호 3번 → 서버를 다시 켤 때까지 끔
 */
export interface AgodaCandidate {
  hid: number;
  name: string;
  city?: string;
}

const TTL = 30 * 86_400_000;
const MAX = 500;
const TIMEOUT_MS = 8000;
const MAX_BYTES = 2_000_000;
const UA = 'TripPocket/1.0 (+https://trippocket.day)';

const cache = new Map<string, { at: number; value: AgodaCandidate[] }>();
const inflight = new Map<string, Promise<AgodaCandidate[]>>();
const breaker = { fails: 0, pausedUntil: 0, blocks: [] as number[], off: false };

/** 멈춘 상태 — 아고다에 묻지 않고 바로 알린다 */
export class LookupPaused extends Error {
  constructor(readonly until: number | null) {
    super('agoda_lookup_paused');
  }
}

class Blocked extends Error {}

export function lookupState(now = Date.now()): { paused: boolean; off: boolean; until: number } {
  return {
    paused: breaker.off || now < breaker.pausedUntil,
    off: breaker.off,
    until: breaker.pausedUntil,
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

/** 응답 → 숙소 후보 (숙소만, 최대 3개). 모양이 다르면 빈 목록이 아니라 실패 */
export function parseSuggest(body: unknown): AgodaCandidate[] {
  const list = (body as { ViewModelList?: unknown } | null)?.ViewModelList;
  if (!Array.isArray(list)) throw new Error('agoda_shape');
  const out: AgodaCandidate[] = [];
  for (const v of list as Record<string, unknown>[]) {
    if (v?.IsHotel !== true) continue;
    const hid = v.ObjectId;
    const name = v.Name;
    if (typeof hid !== 'number' || !Number.isInteger(hid) || hid <= 0) continue;
    if (typeof name !== 'string' || !name.trim()) continue;
    const city =
      typeof v.CityName === 'string' && v.CityName.trim() ? v.CityName.trim() : undefined;
    out.push({
      hid,
      name: name.trim().slice(0, 120),
      ...(city ? { city: city.slice(0, 60) } : {}),
    });
    if (out.length === 3) break;
  }
  return out;
}

async function ask(name: string): Promise<AgodaCandidate[]> {
  guardApi('agoda_lookup');
  trackApi('agoda_lookup');
  const url = `https://www.agoda.com/api/cronos/search/GetUnifiedSuggestResult/3/1/1/0/ko-kr/?${new URLSearchParams(
    { searchText: name, origin: 'KR', cid: '-1', pageTypeId: '1' },
  )}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const type = res.headers.get('content-type') ?? '';
  if (res.status === 403 || res.status === 429 || (res.status >= 300 && res.status < 400))
    throw new Blocked(`agoda ${res.status}`);
  if (!res.ok) throw new Error(`agoda ${res.status}`);
  // 로봇 확인 화면 등 JSON이 아닌 응답 = 차단 신호
  if (!type.includes('json')) throw new Blocked('agoda not json');
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('agoda too large');
  return parseSuggest(JSON.parse(text));
}

export async function agodaLookup(rawName: string, now = Date.now()): Promise<AgodaCandidate[]> {
  const key = rawName.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL) return hit.value;
  const state = lookupState(now);
  if (state.paused) throw new LookupPaused(state.off ? null : state.until);
  const running = inflight.get(key);
  if (running) return running;
  const run = (async () => {
    try {
      const value = await ask(rawName.trim());
      breaker.fails = 0;
      if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch (e) {
      if (e instanceof Blocked) onBlocked(Date.now());
      // 우리 쪽 하루 상한(ApiPaused)은 아고다 실패가 아니다
      else if (!(e instanceof ApiPaused)) onFailed(Date.now());
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

/** 관리자: 차단기만 풀기 (캐시는 그대로) */
export function resumeAgodaLookup(): void {
  Object.assign(breaker, { fails: 0, pausedUntil: 0, blocks: [], off: false });
}

/** 관리자 화면용: 서버가 기억하는 이름 수 */
export const agodaCacheSize = () => cache.size;

/** 시험용 */
export function resetAgodaLookup(): void {
  cache.clear();
  inflight.clear();
  Object.assign(breaker, { fails: 0, pausedUntil: 0, blocks: [], off: false });
}
