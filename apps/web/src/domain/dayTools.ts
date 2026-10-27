import { distanceKm, walkMinutes, type ItineraryItem } from '@trippocket/shared';

/** 항공 출발 일정 다음 구간은 비행 — 걷는 거리·빠듯함·출발 시각을 따지지 않는다 (2026-10-26) */
export const isFlightLeg = (from: Pick<ItineraryItem, 'transport'>) =>
  from.transport?.mode === 'flight';

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * 실험실 "빠듯한 일정 알림": 두 일정 모두 시각·좌표가 있고, 걸어서 걸리는 시간(직선거리 어림)이
 * 시작 시각 차이보다 길면 { walk, gap } (분). 아니면 null
 */
export function tightGap(
  from: Pick<ItineraryItem, 'startTime' | 'endTime' | 'place' | 'transport'>,
  to: Pick<ItineraryItem, 'startTime' | 'place'> | undefined,
): { walk: number; gap: number } | null {
  if (isFlightLeg(from)) return null;
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
 * 시각 있는 일정마다 [시작, 끝) 분 — 끝 = 끝 시각, 없으면 다음 일정 시작, 그것도 없으면 2시간 뒤.
 * 진행 중·지난 일정 판단에 같이 쓴다
 */
function timeWindows(
  items: readonly Pick<ItineraryItem, 'id' | 'startTime' | 'endTime'>[],
): Map<string, { start: number; end: number }> {
  const timed = items
    .filter((i): i is typeof i & { startTime: string } => i.startTime !== undefined)
    .sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
  const out = new Map<string, { start: number; end: number }>();
  timed.forEach((item, n) => {
    const start = minutes(item.startTime);
    const next = timed.slice(n + 1).find((i) => minutes(i.startTime) > start);
    const end = item.endTime
      ? minutes(item.endTime)
      : next
        ? minutes(next.startTime)
        : start + LAST_ITEM_MINUTES;
    out.set(item.id, { start, end });
  });
  return out;
}

/**
 * 여행 당일 현지 시각 now("HH:mm")에 진행 중인 일정 (사용자 요청 2026-10-26).
 * 시작 시각 ≤ now < 끝. 시각 없는 일정은 건너뛴다. 여러 개면 가장 늦게 시작한 것
 */
export function currentItemId(
  items: readonly Pick<ItineraryItem, 'id' | 'startTime' | 'endTime'>[],
  now: string,
): string | null {
  const t = minutes(now);
  let found: string | null = null;
  for (const [id, w] of timeWindows(items)) if (w.start <= t && t < w.end) found = id;
  return found;
}

/**
 * 방문·미방문을 고를 수 있는 지난 일정 (실험실 "방문 기록", 2026-10-26).
 * 지난 날의 일정은 모두, 오늘은 끝난 일정만(시각 없는 일정은 오늘이 지나야). 가고 싶은 곳(날짜 없음)은 아님
 */
export function pastItemIds(
  items: readonly (Pick<ItineraryItem, 'id' | 'date' | 'startTime' | 'endTime'> & {
    kind?: ItineraryItem['kind'];
  })[],
  today: string,
  now: string,
): Set<string> {
  const out = new Set<string>();
  const todays = items.filter((i) => i.date === today);
  const windows = timeWindows(todays);
  const t = minutes(now);
  for (const i of items) {
    // 메모는 방문 기록이 필요 없다 (사용자 요청 2026-10-27)
    if (!i.date || i.date > today || i.kind === 'note') continue;
    if (i.date < today) out.add(i.id);
    else if ((windows.get(i.id)?.end ?? Infinity) <= t) out.add(i.id);
  }
  return out;
}

/** 걸어서 이 분 넘게 걸리면 대중교통 시간으로 출발 시각을 잡는다 */
const WALK_LIMIT = 20;

/**
 * 실험실 "출발 시각 알려 주기": 다음 일정 시작에 맞추려면 몇 시에 나가야 하는지 ("HH:mm").
 * 걸어서 20분 안이면 도보, 넘으면 대중교통(없으면 도보). 다음 일정에 시각이 없으면 null
 */
export function leaveAt(
  nextStart: string | undefined,
  eta: { walk?: number | undefined; transit?: number | undefined },
): string | null {
  if (!nextStart) return null;
  const walk = eta.walk;
  const need = walk !== undefined && walk <= WALK_LIMIT ? walk : (eta.transit ?? walk);
  if (need === undefined) return null;
  const t = Math.max(0, minutes(nextStart) - need);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** 일정 화면 "다음 일정" 줄: 지금 시각 뒤에 시작하는 첫 일정 (메모 빼고, 시각 있는 것만) */
export function nextStop<T extends Pick<ItineraryItem, 'startTime' | 'kind'>>(
  items: readonly T[],
  now: string,
): T | null {
  return (
    [...items]
      .filter((i) => i.kind !== 'note' && !!i.startTime && i.startTime > now)
      .sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1))[0] ?? null
  );
}

const hhmmOf = (m: number) => {
  const c = Math.max(0, m);
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
};

/** 출발 시각 여유 (분) — 길 찾기·환승·입장 대기 (사용자 요청 2026-10-27 "마진을 조금 더") */
export const LEAVE_MARGIN_MIN = 10;

/**
 * 지금 위치에서 다음 일정까지 (사용자 요청 2026-10-27): 걸어서·대중교통 각각 몇 시에 나가면 되는지와,
 * 남은 시간보다 오래 걸리는지. 시간을 모르는 쪽은 비운다.
 * leaveBy = 더 빠른 쪽 시간 + 여유(LEAVE_MARGIN_MIN)를 빼서 "이때까지 출발", leaveNow = 그 시각이 이미 지남
 */
export function departurePlan(
  start: string,
  now: string,
  eta: { walk?: number | undefined; transit?: number | undefined },
): {
  left: number;
  walkLeave?: string;
  transitLeave?: string;
  walkLate: boolean;
  transitLate: boolean;
  leaveBy?: string;
  leaveNow: boolean;
} {
  const left = minutes(start) - minutes(now);
  const times = [eta.walk, eta.transit].filter((n): n is number => n !== undefined);
  const fastest = times.length ? Math.min(...times) : undefined;
  const by = fastest !== undefined ? minutes(start) - fastest - LEAVE_MARGIN_MIN : undefined;
  return {
    left,
    ...(by !== undefined ? { leaveBy: hhmmOf(by) } : {}),
    leaveNow: by !== undefined && by <= minutes(now),
    ...(eta.walk !== undefined ? { walkLeave: hhmmOf(minutes(start) - eta.walk) } : {}),
    ...(eta.transit !== undefined ? { transitLeave: hhmmOf(minutes(start) - eta.transit) } : {}),
    walkLate: eta.walk !== undefined && eta.walk > left,
    transitLate: eta.transit !== undefined && eta.transit > left,
  };
}
