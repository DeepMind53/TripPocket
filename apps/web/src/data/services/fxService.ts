import type { FxSnapshot } from '@trippocket/shared';
import { api } from '../api/client';
import { externalAllowed, reportExternal } from '../api/usage';
import { settingsRepo } from '../repositories/settingsRepo';

/**
 * 환율 가져오기 (docs/12 §2): ① 홈 서버(수출입은행 매매기준율) → ② 무료 보조 출처(currency-api, jsDelivr, 하루 1회)
 * → ③ 마지막으로 받은 값(오프라인). 금액은 저장하지 않고 환율만 기기에 남긴다
 */
const CACHE_KEY = 'fxCache';
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

export async function getFx(): Promise<FxResult | null> {
  const server = await api<FxSnapshot>('/api/fx/latest');
  const fresh = server.ok ? server.data : await fromFallback();
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
