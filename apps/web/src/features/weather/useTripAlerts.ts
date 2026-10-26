import type { DestinationAlert, Trip } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { fetchAlerts } from '../../data/api/alerts';
import { alertQuery, notableAlerts } from '../../domain/alerts';

/**
 * 홈 "날씨 정보" 칸의 특보 점 (docs/24 §2-2): enabled일 때만(출발 7일 전부터) 묻는다.
 * 빨강·주황만, 외교부 상시 단계 제외. 기기에 1시간 보관(data/api/alerts.ts)
 */
export function useTripAlerts(trip: Trip, enabled: boolean): DestinationAlert[] {
  const { countries, points } = alertQuery(trip);
  const key = enabled ? `${countries.join(',')}|${points.join(',')}` : '';
  const [result, setResult] = useState<{ key: string; alerts: DestinationAlert[] } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const [c, p] = key.split('|');
    void fetchAlerts(c ? c.split(',') : [], p ? p.split(',') : []).then((r) => {
      if (alive) setResult({ key, alerts: notableAlerts(r?.data.alerts ?? []) });
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return result && result.key === key ? result.alerts : [];
}
