import { addDays, diffDays, type ItineraryItem, type LocalDate } from '@trippocket/shared';

/**
 * 시간순 정렬: 시간이 있는 일정끼리만 시간 순서로 바꾸고, 시간 없는 일정은 제자리에 둔다.
 * (메모·이동 같은 시간 없는 일정이 엉뚱하게 끝으로 밀리지 않게)
 * @returns 새 순서의 id 목록
 */
export function sortByTimeKeepingUntimed(items: readonly ItineraryItem[]): string[] {
  const timed = items
    .filter((i) => i.startTime)
    .sort((a, b) => (a.startTime as string).localeCompare(b.startTime as string));
  let next = 0;
  return items.map((i) => (i.startTime ? (timed[next++] as ItineraryItem).id : i.id));
}

export type ReflowMode = 'keepDayNumber' | 'keepDate';

export interface DateMove {
  id: string;
  to: LocalDate | null;
}

export interface ReflowPlan {
  moves: DateMove[];
  /** '가고 싶은 곳'으로 가는 일정 수 */
  toWishlist: number;
  /** 날짜가 바뀌는(다른 일차로 가는 게 아니라 날짜만 밀리는) 일정 수 */
  shifted: number;
}

/**
 * 여행 기간 변경 시 일정 처리 계획 (docs/04 §6 reflowOnDateChange, docs/08 C4).
 * - keepDayNumber: "1일차는 계속 1일차" — 출발이 미뤄지면 날짜도 함께 밀린다
 * - keepDate: 날짜 그대로. 새 기간 밖이면 '가고 싶은 곳'으로 (삭제하지 않음)
 */
export function planReflow(
  items: readonly ItineraryItem[],
  oldStart: LocalDate,
  newStart: LocalDate,
  newEnd: LocalDate,
  mode: ReflowMode,
): ReflowPlan {
  const moves: DateMove[] = [];
  let toWishlist = 0;
  let shifted = 0;
  for (const item of items) {
    if (item.date === null) continue;
    let target: LocalDate | null =
      mode === 'keepDayNumber' ? addDays(newStart, diffDays(oldStart, item.date)) : item.date;
    const inRange = diffDays(newStart, target) >= 0 && diffDays(target, newEnd) >= 0;
    if (!inRange) target = null;
    if (target === item.date) continue;
    moves.push({ id: item.id, to: target });
    if (target === null) toWishlist++;
    else shifted++;
  }
  return { moves, toWishlist, shifted };
}

type LatLngLike = { lat: number; lng: number };
const coordsOf = (i: ItineraryItem): LatLngLike | undefined => i.place?.coords;

/** 일정 목록을 이 순서로 돌 때 직선거리 합 (좌표 있는 일정만 이어서) */
export function pathKm(
  items: readonly ItineraryItem[],
  dist: (a: LatLngLike, b: LatLngLike) => number,
): number {
  const pts = items.map(coordsOf).filter((c): c is LatLngLike => !!c);
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += dist(pts[i - 1]!, pts[i]!);
  return km;
}

/**
 * 동선 순서 추천 (docs/20 G6): 시간을 정한 일정·좌표 없는 일정은 제자리에 두고,
 * 시간 없는 장소들의 순서만 바꿔 이동 거리(직선)를 줄인다. 7곳 이하는 모든 순서를, 그보다 많으면 2-opt로.
 * 줄어드는 게 거의 없으면(100m 미만) null
 */
export function shortestOrder(
  items: readonly ItineraryItem[],
  dist: (a: LatLngLike, b: LatLngLike) => number,
): { ids: string[]; savedKm: number } | null {
  const slots = items
    .map((it, i) => (!it.startTime && coordsOf(it) ? i : -1))
    .filter((i) => i >= 0);
  if (slots.length < 2) return null;
  const movable = slots.map((i) => items[i]!);
  const build = (order: readonly ItineraryItem[]) => {
    const out = [...items];
    slots.forEach((slot, k) => (out[slot] = order[k]!));
    return out;
  };
  const before = pathKm(items, dist);
  let best = movable;
  let bestKm = before;
  if (movable.length <= 7) {
    const permute = (rest: ItineraryItem[], acc: ItineraryItem[]) => {
      if (rest.length === 0) {
        const km = pathKm(build(acc), dist);
        if (km < bestKm - 1e-9) {
          bestKm = km;
          best = acc;
        }
        return;
      }
      rest.forEach((x, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, x]));
    };
    permute(movable, []);
  } else {
    let improved = true;
    let cur = [...movable];
    while (improved) {
      improved = false;
      for (let i = 0; i < cur.length - 1; i++)
        for (let j = i + 1; j < cur.length; j++) {
          const next = [...cur.slice(0, i), ...cur.slice(i, j + 1).reverse(), ...cur.slice(j + 1)];
          const km = pathKm(build(next), dist);
          if (km < bestKm - 1e-9) {
            bestKm = km;
            cur = next;
            best = next;
            improved = true;
          }
        }
    }
  }
  const savedKm = before - bestKm;
  if (savedKm < 0.1) return null;
  return { ids: build(best).map((i) => i.id), savedKm };
}
