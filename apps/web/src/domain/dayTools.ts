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
