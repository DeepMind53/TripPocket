import type { ItineraryItem } from '@trippocket/shared';

/**
 * 여행 도움 계산 모음 — 기기 안 데이터로만 계산하는 순수 함수.
 * 시차 안내·늦은 귀가 안내(2026-10-28 정식)와 실험실. 시간대 계산은 Intl만 쓴다
 */

/** 그 시간대에서 이 순간의 UTC와의 차이(분) */
function offsetMinutes(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(at / 60_000) * 60_000) / 60_000);
}

/** 시차 안내: 여행지가 집보다 몇 시간 빠른지 (+ 빠름, - 느림, 소수 가능) */
export function hoursAhead(tripTz: string, homeTz = 'Asia/Seoul', at = Date.now()): number {
  return (offsetMinutes(tripTz, at) - offsetMinutes(homeTz, at)) / 60;
}

/** 늦은 귀가 안내 (설정 "일정", 2026-10-28 정식): 그날 마지막 일정이 22시 이후에 시작하거나 끝나면 그 시각 */
export function lateNightAt(
  items: readonly Pick<ItineraryItem, 'kind' | 'startTime' | 'endTime'>[],
): string | null {
  let latest: string | null = null;
  for (const i of items) {
    if (i.kind === 'note') continue;
    for (const t of [i.startTime, i.endTime])
      if (t && t >= '22:00' && (!latest || t > latest)) latest = t;
  }
  return latest;
}
