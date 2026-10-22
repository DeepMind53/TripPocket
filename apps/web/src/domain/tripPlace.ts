import type { Trip } from '@trippocket/shared';

/**
 * 여행의 장소 기준 (목적지에 저장된 국가·좌표). 지도 중심(17단계), 장소 검색 범위(18단계),
 * 추천 기준(20단계), 국내/해외 판단에 공통으로 쓴다.
 */

/** 국내 여행인가 — 목적지 국가 코드 우선, 모르면(직접 입력만) 시간대로 추정 */
export function isDomesticTrip(trip: Pick<Trip, 'destinations' | 'timezone'>): boolean {
  const codes = trip.destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []));
  if (codes.length > 0) return codes.every((c) => c === 'KR');
  return trip.timezone === 'Asia/Seoul';
}

/** 지도·검색 중심 좌표 (좌표가 있는 첫 목적지) */
export function tripCenter(trip: Pick<Trip, 'destinations'>): { lat: number; lng: number } | null {
  return trip.destinations.find((d) => d.coords)?.coords ?? null;
}

/** 여행 국가 코드 목록 (중복 없이) */
export function tripCountries(trip: Pick<Trip, 'destinations'>): string[] {
  return [...new Set(trip.destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : [])))];
}
