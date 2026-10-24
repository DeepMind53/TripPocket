import { create } from 'zustand';
import type { FallbackLink } from '../shared/lib/fallbackLinks';

/**
 * 사용량 한도로 서버가 거절했을 때 안내 팝업 (사용자 요청 2026-10-24).
 * - api_paused: 관리자가 멈췄거나 무료 사용량 자동 중지 (api = 외부 API id)
 * - daily_limit: 한 사람 하루 한도 (feature = ai | places_search | places_details)
 * 같은 이유는 이번 실행에서 한 번만 띄운다 (입력할 때마다 뜨지 않게)
 */
export type LimitNotice =
  { kind: 'api_paused'; api: string } | { kind: 'daily_limit'; feature: string; limit?: number };

export const useLimitNotice = create<{ notice: LimitNotice | null; links: FallbackLink[] }>(() => ({
  notice: null,
  links: [],
}));

/** 지금 뜬 한도 안내에 "직접 보기" 페이지를 붙인다 (부른 쪽이 검색어 등을 알 때) */
export function attachFallback(links: FallbackLink[]): void {
  if (useLimitNotice.getState().notice) useLimitNotice.setState({ links });
}
const shown = new Set<string>();

export function reportLimit(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as { error?: unknown; api?: unknown; feature?: unknown; limit?: unknown };
  let notice: LimitNotice | null = null;
  if (b.error === 'api_paused') notice = { kind: 'api_paused', api: String(b.api ?? '') };
  else if (b.error === 'daily_limit')
    notice = {
      kind: 'daily_limit',
      feature: String(b.feature ?? ''),
      ...(typeof b.limit === 'number' ? { limit: b.limit } : {}),
    };
  if (!notice) return false;
  const key = notice.kind === 'api_paused' ? `p:${notice.api}` : `d:${notice.feature}`;
  if (!shown.has(key)) {
    shown.add(key);
    useLimitNotice.setState({ notice, links: [] });
  }
  return true;
}

/** 시험용 */
export const resetLimitNotices = () => {
  shown.clear();
  useLimitNotice.setState({ notice: null, links: [] });
};
