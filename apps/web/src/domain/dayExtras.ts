import { distanceKm, type Booking, type ItineraryItem, type LocalDate } from '@trippocket/shared';
import { FAR_LEG_KM } from './busyDay';

/**
 * 실험실 (2026-10-27 새 실험) — 하루 일정 화면에 덧붙이는 정보. 모두 기기 안 데이터로 계산(외부 호출 없음)
 */

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** 빈 시간으로 볼 최소 길이 (분) */
export const FREE_GAP_MIN = 120;

/**
 * "빈 시간": 시각이 있는 일정끼리(목록 순서대로) 앞 일정이 끝나고(끝 시각 없으면 시작) 다음 일정 시작까지
 * 2시간 이상이면 { afterId, minutes }. 메모·시각 없는 일정은 건너뛴다
 */
export function freeGaps(
  items: readonly Pick<ItineraryItem, 'id' | 'kind' | 'startTime' | 'endTime'>[],
): { afterId: string; minutes: number }[] {
  const timed = items.filter((i) => i.kind !== 'note' && i.startTime);
  const out: { afterId: string; minutes: number }[] = [];
  for (let k = 0; k + 1 < timed.length; k++) {
    const a = timed[k]!;
    const b = timed[k + 1]!;
    const gap = minutes(b.startTime!) - minutes(a.endTime ?? a.startTime!);
    if (gap >= FREE_GAP_MIN) out.push({ afterId: a.id, minutes: gap });
  }
  return out;
}

/** 이 안이면 "근처" (km) */
export const NEARBY_KM = 1;

/**
 * "근처 가고 싶은 곳": 날짜 없는 가고 싶은 곳 중 그날 일정 장소에서 1km 안인 것 (가까운 순)
 */
export function nearbyWishes<T extends Pick<ItineraryItem, 'id' | 'place'>>(
  day: readonly Pick<ItineraryItem, 'kind' | 'place'>[],
  wishes: readonly T[],
): T[] {
  const spots = day
    .filter((i) => i.kind !== 'note' && i.place?.coords)
    .map((i) => i.place!.coords!);
  if (!spots.length) return [];
  return wishes
    .flatMap((w) => {
      const c = w.place?.coords;
      if (!c) return [];
      const d = Math.min(...spots.map((s) => distanceKm(s, c)));
      return d <= NEARBY_KM ? [{ w, d }] : [];
    })
    .sort((a, b) => a.d - b.d)
    .map(({ w }) => w);
}

/** "오늘 체크아웃": 그날 체크아웃하는 숙소 예약 (시각 있으면 함께) */
export function checkoutsOn(
  bookings: readonly Booking[],
  date: LocalDate,
): { title: string; time?: string | undefined }[] {
  return bookings
    .filter((b) => b.kind === 'lodging' && !b.deletedAt && b.end?.date === date)
    .map((b) => ({ title: b.title, time: b.end?.time }));
}

/**
 * "오늘 돌아보기": 방문한 일정 수와, 방문한 곳을 순서대로 이은 직선거리 합 (항공·먼 구간 빼고, km 소수 1자리)
 */
export function dayRecap(
  items: readonly Pick<ItineraryItem, 'kind' | 'place' | 'visit' | 'done' | 'transport'>[],
): { visited: number; km: number } {
  const visited = items.filter((i) => i.kind !== 'note' && (i.visit === 'visited' || i.done));
  let km = 0;
  let prev: { lat: number; lng: number } | undefined;
  for (const i of visited) {
    const c = i.place?.coords;
    if (!c || i.transport?.mode === 'flight') continue;
    if (prev) {
      const d = distanceKm(prev, c);
      if (d <= FAR_LEG_KM) km += d;
    }
    prev = c;
  }
  return { visited: visited.length, km: Math.round(km * 10) / 10 };
}
