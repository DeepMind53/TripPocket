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
