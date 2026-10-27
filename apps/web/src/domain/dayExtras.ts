import { distanceKm, type Booking, type ItineraryItem, type LocalDate } from '@trippocket/shared';
import { FAR_LEG_KM } from './dayTools';

/**
 * 실험실 (2026-10-27 새 실험) — 하루 일정 화면에 덧붙이는 정보. 모두 기기 안 데이터로 계산(외부 호출 없음)
 */

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
    if (!c) continue;
    // 공항까지는 땅길로 더하고, 항공편 다음 구간(비행)은 잇지 않는다
    if (prev) {
      const d = distanceKm(prev, c);
      if (d <= FAR_LEG_KM) km += d;
    }
    prev = i.transport?.mode === 'flight' ? undefined : c;
  }
  return { visited: visited.length, km: Math.round(km * 10) / 10 };
}
