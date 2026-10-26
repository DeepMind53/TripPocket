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

/** 이 정도 안이면 같은 장소로 본다 (이름이 같을 때, km) */
const SAME_PLACE_KM = 0.3;

const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/[\s·\-()]/g, '');

/** 두 일정이 같은 장소인지: Google 장소 id가 같거나, 이름이 같고 (좌표가 있으면) 300m 안 */
export function samePlace(
  a: Pick<ItineraryItem, 'title' | 'place'>,
  b: Pick<ItineraryItem, 'title' | 'place'>,
): boolean {
  if (a.place?.googlePlaceId && a.place.googlePlaceId === b.place?.googlePlaceId) return true;
  const na = norm(a.place?.name ?? a.title);
  if (!na || na !== norm(b.place?.name ?? b.title)) return false;
  const ca = a.place?.coords;
  const cb = b.place?.coords;
  if (!ca || !cb) return true;
  const dLat = ((ca.lat - cb.lat) * Math.PI) / 180;
  const dLng = ((ca.lng - cb.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((ca.lat * Math.PI) / 180) *
      Math.cos((cb.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) <= SAME_PLACE_KM;
}

/**
 * 이 장소를 예전에 방문한 기록 (사용자 요청 2026-10-27): 이 일정보다 앞선 날짜에 "방문"으로 남긴 같은 장소.
 * 날짜 오래된 순. 메모·자기 자신은 빼고
 */
export function earlierVisits<
  T extends Pick<ItineraryItem, 'id' | 'date' | 'kind' | 'visit' | 'title' | 'place'>,
>(
  item: Pick<ItineraryItem, 'id' | 'date' | 'kind' | 'title' | 'place'>,
  visited: readonly T[],
): T[] {
  if (item.kind === 'note') return [];
  return visited
    .filter(
      (v) =>
        v.id !== item.id &&
        v.visit === 'visited' &&
        v.kind !== 'note' &&
        !!v.date &&
        (!item.date || v.date < item.date) &&
        samePlace(item, v),
    )
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
}
