import { addDays, getTripDays, todayIn, type LocalDate, type Trip } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { getForecast, getLastYearWeather } from '../../data/services/travelInfo';
import type { DayWeather } from '../../domain/weather';

/** 예보는 오늘부터 16일 (Open-Meteo) — 그 뒤 날은 작년 같은 날 기록 */
export const FORECAST_DAYS = 16;

export interface TripDayWeather extends DayWeather {
  /** 작년 기록이면 그 해 (예: 2025) — 예보면 없음 */
  year?: number;
}

/**
 * 여행 날짜별 날씨 (사용자 요청 2026-10-25): 2주 안쪽은 달력과 같은 예보,
 * 그보다 먼 날은 작년 같은 날의 실제 최저·최고·날씨. 지난 날은 비움.
 * 보내는 정보: 목적지 도시 좌표·날짜뿐
 */
export function useTripWeather(trip: Trip | undefined): Record<LocalDate, TripDayWeather> {
  const [out, setOut] = useState<Record<LocalDate, TripDayWeather>>({});
  const coords = trip?.destinations.find((d) => d.coords)?.coords;
  const tz = trip?.timezone ?? 'Asia/Seoul';
  const start = trip?.startDate;
  const end = trip?.endDate;

  useEffect(() => {
    if (!coords || !start || !end) return;
    let alive = true;
    const today = todayIn(tz);
    const lastForecast = addDays(today, FORECAST_DAYS - 1);
    const days = getTripDays(start, end).filter((d) => d >= today);
    const near = days.filter((d) => d <= lastForecast);
    const far = days.filter((d) => d > lastForecast);
    void Promise.all([
      near.length ? getForecast(coords.lat, coords.lng, tz) : Promise.resolve({}),
      getLastYearWeather(coords.lat, coords.lng, tz, far),
    ]).then(([f, ly]: [Record<LocalDate, DayWeather>, Record<LocalDate, DayWeather>]) => {
      if (!alive) return;
      const next: Record<LocalDate, TripDayWeather> = {};
      for (const d of near) if (f[d]) next[d] = f[d];
      for (const d of far) if (ly[d]) next[d] = { ...ly[d], year: Number(d.slice(0, 4)) - 1 };
      setOut(next);
    });
    return () => {
      alive = false;
    };
  }, [coords?.lat, coords?.lng, tz, start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  return out;
}
