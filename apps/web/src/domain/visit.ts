import type { ItineraryItem } from '@trippocket/shared';

export type Visit = NonNullable<ItineraryItem['visit']>;
type VisitFields = Pick<ItineraryItem, 'done' | 'visit'>;

/**
 * 다녀옴(done)과 방문 기록(visit)을 함께 맞춘다 (2026-10-26).
 * - 방문 → 다녀옴도 켬, 미방문 → 다녀옴 끔, 기록 지움(null) → 다녀옴 끔
 * - 다녀옴만 바꾸면: 켜면 방문, 끄면 방문 기록도 지움(미방문 기록은 그대로)
 */
export function visitPatch(
  current: VisitFields,
  patch: { done?: boolean | undefined; visit?: Visit | null | undefined },
): { done?: boolean | undefined; visit?: Visit | undefined } {
  if (patch.visit !== undefined) {
    if (patch.visit === null) return { done: undefined, visit: undefined };
    return { visit: patch.visit, done: patch.visit === 'visited' ? true : undefined };
  }
  if (patch.done === true) return { done: true, visit: 'visited' };
  if (patch.done === false)
    return { done: undefined, visit: current.visit === 'skipped' ? 'skipped' : undefined };
  return {};
}
