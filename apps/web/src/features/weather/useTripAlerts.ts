import { alertQuery, notableAlerts, type DestinationAlert, type Trip } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { fetchAlerts } from '../../data/api/alerts';

/**
 * 홈의 여행지 특보 표시 (docs/24 §2-2): enabled일 때만(출발 7일 전 ~ 귀국일) 묻는다.
 * 빨강·주황만, 외교부 상시 단계 제외. 기기에 1시간 보관(data/api/alerts.ts)
 */
export function useTripAlerts(trip: Trip, enabled: boolean): DestinationAlert[] {
  const { countries, points } = alertQuery(trip);
  const key = enabled && countries.length ? `${countries.join(',')}|${points.join(',')}` : '';
  const [result, setResult] = useState<{ key: string; alerts: DestinationAlert[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const q = alertQuery(trip);
    void fetchAlerts(q.countries, q.points).then((r) => {
      if (alive) setResult({ key, alerts: notableAlerts(r?.data.alerts ?? []) });
    });
    return () => {
      alive = false;
    };
    // key에 나라·좌표가 모두 담겨 있다 (trip 객체는 매번 새로 와서 의존성으로 쓰지 않음)
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return result && result.key === key ? result.alerts : [];
}
