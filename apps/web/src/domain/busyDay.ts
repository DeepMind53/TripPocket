import { distanceKm, type ItineraryItem } from '@trippocket/shared';

/** 실험실 "빠듯한 하루" (2026-10-27): 이만큼 넘으면 날짜 머리에 표시 */
export const BUSY_ITEMS = 7;
export const BUSY_KM = 15;
/** 이보다 먼 구간은 걷거나 대중교통으로 가는 거리가 아니다 (비행기·다른 나라) — 거리 표시·합계에서 뺀다 */
export const FAR_LEG_KM = 200;

/**
 * 하루 일정이 많거나(메모 빼고 7개 이상) 일정 사이 직선거리 합이 15km 이상이면 { count, km }.
 * 항공 구간은 거리에서 뺀다. 아니면 null
 */
export function busyDay(
  items: readonly Pick<ItineraryItem, 'kind' | 'place' | 'transport'>[],
): { count: number; km: number } | null {
  const tracked = items.filter((i) => i.kind !== 'note');
  let km = 0;
  let prev: { lat: number; lng: number } | undefined;
  let prevFlight = false;
  for (const i of tracked) {
    const c = i.place?.coords;
    if (c && prev && !prevFlight && distanceKm(prev, c) <= FAR_LEG_KM) km += distanceKm(prev, c);
    if (c) prev = c;
    prevFlight = i.transport?.mode === 'flight';
  }
  const rounded = Math.round(km * 10) / 10;
  return tracked.length >= BUSY_ITEMS || rounded >= BUSY_KM
    ? { count: tracked.length, km: rounded }
    : null;
}
