import type { SavedPlace } from '@trippocket/shared';

/** 나라 모를 때 칸 이름 */
export const UNKNOWN_COUNTRY = '';

/**
 * 저장 탭 나라 칸 (사용자 요청 2026-10-26): 저장한 장소가 많은 나라 먼저, 같으면 처음 저장한 순.
 * 나라를 모르는 장소는 맨 뒤 한 칸
 */
export function countryGroups(
  places: readonly Pick<SavedPlace, 'countryCode' | 'createdAt'>[],
): { code: string; count: number }[] {
  const first = new Map<string, string>();
  const count = new Map<string, number>();
  for (const p of places) {
    const c = p.countryCode ?? UNKNOWN_COUNTRY;
    count.set(c, (count.get(c) ?? 0) + 1);
    if (!first.has(c) || p.createdAt < first.get(c)!) first.set(c, p.createdAt);
  }
  return [...count]
    .map(([code, n]) => ({ code, count: n }))
    .sort((a, b) => {
      if ((a.code === UNKNOWN_COUNTRY) !== (b.code === UNKNOWN_COUNTRY))
        return a.code === UNKNOWN_COUNTRY ? 1 : -1;
      return b.count - a.count || first.get(a.code)!.localeCompare(first.get(b.code)!);
    });
}
