import { distanceKm, walkMinutes, type ItineraryItem } from '@trippocket/shared';

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * 실험실 "빠듯한 일정 알림": 두 일정 모두 시각·좌표가 있고, 걸어서 걸리는 시간(직선거리 어림)이
 * 시작 시각 차이보다 길면 { walk, gap } (분). 아니면 null
 */
export function tightGap(
  from: Pick<ItineraryItem, 'startTime' | 'endTime' | 'place'>,
  to: Pick<ItineraryItem, 'startTime' | 'place'> | undefined,
): { walk: number; gap: number } | null {
  const a = from.place?.coords;
  const b = to?.place?.coords;
  if (!a || !b || !from.startTime || !to?.startTime) return null;
  // 끝나는 시각을 적어 두었으면 그때부터, 아니면 시작 시각부터
  const leave = minutes(from.endTime ?? from.startTime);
  const gap = minutes(to.startTime) - leave;
  if (gap < 0) return null;
  const walk = walkMinutes(distanceKm(a, b));
  return walk > gap ? { walk, gap } : null;
}

/** 실험실 "하루 일정 글로 복사": 카톡 등에 붙여 넣을 글 (제목 줄 + 한 줄에 일정 하나) */
export function dayText(
  heading: string,
  items: readonly Pick<ItineraryItem, 'kind' | 'title' | 'memo' | 'startTime' | 'place'>[],
  time: (t: string | undefined) => string | null | undefined,
): string {
  const lines = items.map((i, n) => {
    const name = i.kind === 'note' ? (i.memo ?? i.title).split('\n')[0]! : i.title;
    const at = time(i.startTime);
    const addr = i.kind !== 'note' && i.place?.address ? ` (${i.place.address})` : '';
    return `${n + 1}. ${at ? `${at} ` : ''}${name}${addr}`;
  });
  return [heading, ...lines].join('\n');
}

/** 끝 시각도 다음 일정도 없는 마지막 일정은 시작부터 이만큼 진행 중으로 본다 (분) */
const LAST_ITEM_MINUTES = 120;

/**
 * 여행 당일 현지 시각 now("HH:mm")에 진행 중인 일정 (사용자 요청 2026-10-26).
 * 시작 시각 ≤ now < 끝(끝 시각, 없으면 다음 일정 시작, 그것도 없으면 2시간 뒤). 시각 없는 일정은 건너뛴다.
 * 여러 개면 가장 늦게 시작한 것
 */
export function currentItemId(
  items: readonly Pick<ItineraryItem, 'id' | 'startTime' | 'endTime'>[],
  now: string,
): string | null {
  const timed = items
    .filter((i): i is typeof i & { startTime: string } => i.startTime !== undefined)
    .sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
  const t = minutes(now);
  let found: string | null = null;
  timed.forEach((item, n) => {
    const start = minutes(item.startTime);
    const next = timed.slice(n + 1).find((i) => minutes(i.startTime) > start);
    const end = item.endTime
      ? minutes(item.endTime)
      : next
        ? minutes(next.startTime)
        : start + LAST_ITEM_MINUTES;
    if (start <= t && t < end) found = item.id;
  });
  return found;
}
