import { addDays, getTripDays, todayIn, type LocalDate, type Trip } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { useSettings } from '../../data/settingsStore';
import { api } from '../../data/api/client';
import { sidoOf } from '../../domain/sido';
import { getAirQuality, getForecast, getLastYearWeather } from '../../data/services/travelInfo';
import type { DayAir } from '../../domain/air';
import type { DayWeather } from '../../domain/weather';

/** 예보는 오늘부터 16일 (Open-Meteo) — 그 뒤 날은 작년 같은 날 기록 */
export const FORECAST_DAYS = 16;

export interface TripDayWeather extends DayWeather {
  /** 작년 기록이면 그 해 (예: 2025) — 예보면 없음 */
  year?: number;
  /** 이미 지난 날 (최근 7일, 예보 API의 지난 날 값) */
  past?: true;
  /** 실험실 "미세먼지·자외선": 5일 안 예보만 */
  air?: DayAir;
}

/** 지난 날도 이만큼은 보여 준다 (Open-Meteo past_days) */
export const PAST_DAYS = 7;

/**
 * 여행 날짜별 날씨 (사용자 요청 2026-10-25): 2주 안쪽은 달력과 같은 예보,
 * 그보다 먼 날은 작년 같은 날의 실제 최저·최고·날씨. 지난 날은 비움.
 * 보내는 정보: 목적지 도시 좌표·날짜뿐
 */
export function useTripWeather(trip: Trip | undefined): Record<LocalDate, TripDayWeather> {
  const coords = trip?.destinations.find((d) => d.coords)?.coords;
  const dates = trip ? getTripDays(trip.startDate, trip.endDate) : [];
  const air = useSettings((s) => s.airQuality);
  const days = useWeatherDays(coords, trip?.timezone ?? 'Asia/Seoul', dates, air);
  // 국내 여행 오늘 미세먼지는 에어코리아 공식 측정값으로 (docs/26 B5, 서버 경유·시도 평균)
  const today = trip ? todayIn(trip.timezone) : '';
  const sido =
    air && trip && trip.destinations.every((d) => !d.countryCode || d.countryCode === 'KR')
      ? sidoOf(trip.destinations[0]?.name ?? '')
      : null;
  const krPm = useKrPm25(sido && dates.includes(today) ? sido : null);
  if (krPm == null || !days[today]) return days;
  return { ...days, [today]: { ...days[today], air: { ...days[today].air, pm25: krPm } } };
}

/** 에어코리아 시도 평균 PM2.5 (한 번만 받는다, 실패하면 null) */
function useKrPm25(sido: string | null): number | null {
  const [v, setV] = useState<{ sido: string; pm25: number } | null>(null);
  useEffect(() => {
    if (!sido) return;
    let alive = true;
    void api<{ air: { pm25: number } | null }>(
      `/api/info/air-kr?sido=${encodeURIComponent(sido)}`,
    ).then((r) => {
      if (alive && r.ok && r.data.air) setV({ sido, pm25: r.data.air.pm25 });
    });
    return () => {
      alive = false;
    };
  }, [sido]);
  return v && v.sido === sido ? v.pm25 : null;
}

/**
 * 좌표 한 곳의 날짜별 날씨 (날씨 정보 화면: 여행 앞뒤 하루·출발 공항, 2026-10-26).
 * 오늘부터 16일은 예보, 그 뒤는 작년 같은 날 기록, 지난 7일은 지난 날씨, 그보다 오래된 날은 비움
 * (2026-10-27: 오늘 출발이면 '여행 전날'이 비던 문제 — 지난 7일을 더함)
 */
export function useWeatherDays(
  coords: { lat: number; lng: number } | undefined,
  tz: string,
  dates: readonly LocalDate[],
  /** 미세먼지·자외선도 함께 (실험실) */
  withAir = false,
): Record<LocalDate, TripDayWeather> {
  const [out, setOut] = useState<Record<LocalDate, TripDayWeather>>({});
  const key = dates.join(',');

  useEffect(() => {
    if (!coords || dates.length === 0) return;
    let alive = true;
    const today = todayIn(tz);
    const lastForecast = addDays(today, FORECAST_DAYS - 1);
    const days = dates.filter((d) => d >= addDays(today, -PAST_DAYS));
    const near = days.filter((d) => d <= lastForecast);
    const far = days.filter((d) => d > lastForecast);
    void Promise.all([
      near.length ? getForecast(coords.lat, coords.lng, tz) : Promise.resolve({}),
      getLastYearWeather(coords.lat, coords.lng, tz, far),
      withAir && near.length ? getAirQuality(coords.lat, coords.lng, tz) : Promise.resolve({}),
    ]).then(
      ([f, ly, air]: [
        Record<LocalDate, DayWeather>,
        Record<LocalDate, DayWeather>,
        Record<LocalDate, DayAir>,
      ]) => {
        if (!alive) return;
        const next: Record<LocalDate, TripDayWeather> = {};
        for (const d of near)
          if (f[d])
            next[d] =
              d < today ? { ...f[d], past: true } : air[d] ? { ...f[d], air: air[d] } : f[d];
        for (const d of far) if (ly[d]) next[d] = { ...ly[d], year: Number(d.slice(0, 4)) - 1 };
        setOut(next);
      },
    );
    return () => {
      alive = false;
    };
  }, [coords?.lat, coords?.lng, tz, key, withAir]); // eslint-disable-line react-hooks/exhaustive-deps

  return out;
}
