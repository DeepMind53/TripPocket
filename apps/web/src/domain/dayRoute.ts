import type { ItineraryItem } from '@trippocket/shared';

/**
 * 하루 동선을 Google 지도 길찾기로 (실험실 "하루 동선 지도로", 2026-10-27) — 키 없는 공식 URL(딥링크), 외부 호출 없음.
 * 좌표가 있는 장소를 일정 순서대로: 첫 곳 → 경유(최대 8곳) → 마지막 곳. 메모·좌표 없는 일정은 건너뛴다.
 * 2곳보다 적으면 null
 */
export function dayRouteUrl(
  items: readonly Pick<ItineraryItem, 'kind' | 'place'>[],
  mode: 'walking' | 'transit' | 'driving' = 'transit',
): string | null {
  const pts = items
    .flatMap((i) => (i.kind !== 'note' && i.place?.coords ? [i.place.coords] : []))
    .map((c) => `${c.lat},${c.lng}`)
    .filter((p, idx, arr) => idx === 0 || arr[idx - 1] !== p);
  if (pts.length < 2) return null;
  const route = pts.length > 10 ? [...pts.slice(0, 9), pts[pts.length - 1]!] : pts;
  const q = new URLSearchParams({
    api: '1',
    origin: route[0]!,
    destination: route[route.length - 1]!,
    travelmode: mode,
  });
  const way = route.slice(1, -1);
  if (way.length) q.set('waypoints', way.join('|'));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}
