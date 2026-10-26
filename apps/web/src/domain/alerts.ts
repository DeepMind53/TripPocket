import {
  POINT_ALERT_COUNTRIES,
  roundAlertPoint,
  type AlertLevel,
  type DestinationAlert,
  type Trip,
} from '@trippocket/shared';

/**
 * 여행지 특보를 물을 때 보낼 값 (docs/24): 나라 코드 + 일본·미국·캐나다는 목적지 도시 좌표를 약 10km로 줄인 "JP:35.7:139.7".
 * 사용자 현재 위치가 아니라 여행 목적지 좌표
 */
export function alertQuery(trip: Pick<Trip, 'destinations'>): {
  countries: string[];
  points: string[];
} {
  const countries = [
    ...new Set(trip.destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []))),
  ];
  const points = [
    ...new Set(
      trip.destinations.flatMap((d) =>
        d.countryCode && d.coords && POINT_ALERT_COUNTRIES.includes(d.countryCode)
          ? [`${d.countryCode}:${roundAlertPoint(d.coords.lat)}:${roundAlertPoint(d.coords.lng)}`]
          : [],
      ),
    ),
  ];
  return { countries, points };
}

/**
 * 홈 점·알림에 쓸 특보만: 빨강·주황. 외교부 여행경보 단계는 거의 바뀌지 않는 상시 정보라 뺀다
 * (특별여행주의보·경보는 포함) — 서버 services/alertPush.ts와 같은 기준
 */
export function notableAlerts(alerts: readonly DestinationAlert[]): DestinationAlert[] {
  return alerts.filter((a) => a.level !== 'info' && !(a.source === 'mofa' && !a.special));
}

/** 가장 높은 등급 (없으면 null) */
export function topLevel(alerts: readonly DestinationAlert[]): Exclude<AlertLevel, 'info'> | null {
  if (alerts.some((a) => a.level === 'red')) return 'red';
  if (alerts.some((a) => a.level === 'orange')) return 'orange';
  return null;
}
