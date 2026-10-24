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
const FALLBACK =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/krw.json';

export interface FxResult extends FxSnapshot {
  /** 새로 받지 못하고 저장해 둔 값을 보여 주는 중 */
  stale: boolean;
}

async function fromFallback(): Promise<FxSnapshot | null> {
  try {
    if (!(await externalAllowed('jsdelivr'))) return null;
    reportExternal('jsdelivr');
    const res = await fetch(FALLBACK);
    if (!res.ok) return null;
    const body = (await res.json()) as { date?: unknown; krw?: Record<string, unknown> };
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
async function fallbackToday(allowOld: boolean): Promise<FxSnapshot | null> {
  const saved = await settingsRepo.get<FxSnapshot | null>(FALLBACK_KEY, null);
  const today = new Date().toDateString();
  if (saved && new Date(saved.fetchedAt).toDateString() === today) return saved;
  const fresh = await fromFallback();
  if (fresh) await settingsRepo.set(FALLBACK_KEY, fresh);
  return fresh ?? (allowOld ? saved : null);
}

export async function getFx(): Promise<FxResult | null> {
  const server = await api<FxSnapshot>('/api/fx/latest');
  const fresh = server.ok
    ? mergeFallbackRates(server.data, await fallbackToday(true))
    : await fallbackToday(false);
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
