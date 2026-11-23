import type { Trip } from '@trippocket/shared';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { TripCard, TripMenuSheet } from '../trips/TripList';

/**
 * 홈 맨 위 가장 가까운 여행 (사용자 요청 2026-11-23): '내 여행' 목록 카드와 같은 모양(날씨·⋯ 포함)에
 * 표지 색 바탕 + 흰 글자. 여행 중이면 민트. 출발 전·여행 중 모두 이 카드
 */
export function FeaturedTrip({ trip }: { trip: Trip }) {
  // 목록의 메뉴(trip-menu)와 따로 — 홈에는 둘 다 있다
  const [open, setOpen] = useRouteSheet('featured-trip-menu');
  return (
    <>
      <TripCard trip={trip} as="div" onColor onMenu={() => setOpen(true)} />
      <TripMenuSheet trip={trip} open={open} onOpenChange={setOpen} />
    </>
  );
}
