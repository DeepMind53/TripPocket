import type { LocalDate, Trip } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { getHolidays } from '../../data/services/travelInfo';
import { holidayFullName } from '../../domain/holidays';
import { tripCountries } from '../../domain/tripPlace';

/**
 * 실험실 "현지 공휴일 표시" (2026-10-28): 여행 나라의 공휴일 날짜 → 이름.
 * 한국 여행은 빼고(국내는 이미 아는 날), 켰을 때만 받는다 (달력과 같은 저장값을 다시 씀)
 */
export function useTripHolidays(trip: Trip, on: boolean): Record<LocalDate, string> {
  const [out, setOut] = useState<Record<LocalDate, string>>({});
  const countries = tripCountries(trip)
    .filter((c) => c !== 'KR')
    .join(',');
  const years = [...new Set([trip.startDate.slice(0, 4), trip.endDate.slice(0, 4)])].join(',');
  useEffect(() => {
    if (!on || !countries) return;
    let alive = true;
    void Promise.all(
      countries.split(',').flatMap((cc) => years.split(',').map((y) => getHolidays(cc, Number(y)))),
    ).then((lists) => {
      if (!alive) return;
      const map: Record<LocalDate, string> = {};
      for (const h of lists.flatMap((l) => l ?? [])) map[h.date] ??= holidayFullName(h);
      setOut(map);
    });
    return () => {
      alive = false;
    };
  }, [on, countries, years]);
  return on ? out : {};
}
