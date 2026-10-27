import { mergeFallbackRates, type FxSnapshot } from '@trippocket/shared';
import { api } from '../api/client';
import { externalAllowed, reportExternal } from '../api/usage';
import { settingsRepo } from '../repositories/settingsRepo';

/**
 * 환율 가져오기 (docs/12 §2): ① 홈 서버(수출입은행 매매기준율) → ② 무료 보조 출처(currency-api, jsDelivr, 하루 1회)
 * → ③ 마지막으로 받은 값(오프라인). 금액은 저장하지 않고 환율만 기기에 남긴다.
 * 수출입은행이 고시하지 않는 통화(대만달러·베트남 동·필리핀 페소 등)는 ②로 채운다 (화면에 "국제 시세" 표시)
 */
const CACHE_KEY = 'fxCache';
/** 보조 출처는 하루 한 번만 받는다 (jsDelivr 사용량) */
const FALLBACK_KEY = 'fxFallbackCache';
/**
 * 같은 데이터의 두 주소. jsDelivr의 @latest는 며칠 늦게 바뀌어(2026-10-28: 26일 값, 최신 27일)
 * 제작자가 안내하는 Cloudflare 주소를 먼저 쓰고, 안 되면 jsDelivr
 */
const FALLBACKS = [
  'https://latest.currency-api.pages.dev/v1/currencies/krw.json',
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/krw.json',
];
/** 그날 받은 값이 이만큼 오래된 날짜면 다시 받는다 (단, 한 시간에 한 번까지) */
const OLD_MS = 2 * 24 * 3600 * 1000;
const RETRY_MS = 3600 * 1000;

export interface FxResult extends FxSnapshot {
  /** 새로 받지 못하고 저장해 둔 값을 보여 주는 중 */
  stale: boolean;
}

async function fetchFallback(): Promise<{ date?: unknown; krw?: Record<string, unknown> } | null> {
  for (const url of FALLBACKS) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as { date?: unknown; krw?: Record<string, unknown> };
    } catch {
      // 다음 주소
    }
  }
  return null;
}

async function fromFallback(): Promise<FxSnapshot | null> {
  try {
    if (!(await externalAllowed('jsdelivr'))) return null;
    reportExternal('jsdelivr');
    const body = await fetchFallback();
    if (!body) return null;
    if (typeof body.date !== 'string' || typeof body.krw !== 'object' || !body.krw) return null;
    // 1원 = x외화 → 1외화 = 1/x원
    const rates: Record<string, number> = {};
    for (const [code, v] of Object.entries(body.krw))
      if (typeof v === 'number' && v > 0 && /^[a-z]{3}$/.test(code))
        rates[code.toUpperCase()] = 1 / v;
    return { source: 'currency-api', date: body.date, fetchedAt: new Date().toISOString(), rates };
  } catch {
    return null;
  }
}

/**
 * 보조 출처: 오늘 받은 것이 있으면 그것, 없으면 새로.
 * 새로 받지 못하면 allowOld일 때만 전에 받은 것 (수출입은행 값에 빠진 통화를 채울 때) — 아니면 null → 최신 아님 표시
 */
async function fallbackToday(allowOld: boolean, force = false): Promise<FxSnapshot | null> {
  const saved = await settingsRepo.get<FxSnapshot | null>(FALLBACK_KEY, null);
  if (saved) {
    const now = Date.now();
    const age = now - Date.parse(saved.fetchedAt);
    const sameDay = new Date(saved.fetchedAt).toDateString() === new Date(now).toDateString();
    const oldDate = now - Date.parse(saved.date) > OLD_MS;
    // 오늘 받았고 날짜도 최근이면 그대로. 날짜가 오래됐으면 다시(한 시간에 한 번까지),
    // 통화를 골라 바로 새로 받을 때(force)는 1분에 한 번까지
    if (age < (force ? 60_000 : RETRY_MS) || (sameDay && !oldDate && !force)) return saved;
  }
  const fresh = await fromFallback();
  if (fresh) await settingsRepo.set(FALLBACK_KEY, fresh);
  return fresh ?? (allowOld ? saved : null);
}

/** force = 통화를 골랐는데 환율이 오래됐을 때 (보조 출처를 하루 한 번 규칙과 상관없이 다시) */
export async function getFx(opts: { force?: boolean } = {}): Promise<FxResult | null> {
  const server = await api<FxSnapshot>('/api/fx/latest');
  const fresh = server.ok
    ? mergeFallbackRates(server.data, await fallbackToday(true, opts.force))
    : await fallbackToday(false, opts.force);
  if (fresh) {
    await settingsRepo.set(CACHE_KEY, fresh);
    return { ...fresh, stale: false };
  }
  const cached = await settingsRepo.get<FxSnapshot | null>(CACHE_KEY, null);
  return cached ? { ...cached, stale: true } : null;
}

/** 저장해 둔 값만 (화면을 바로 그릴 때) */
export async function cachedFx(): Promise<FxSnapshot | null> {
  return settingsRepo.get<FxSnapshot | null>(CACHE_KEY, null);
}
