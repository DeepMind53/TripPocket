import type { Destination, LocalDate } from '@trippocket/shared';
import { useEffect, useMemo, useState } from 'react';
import { useSetting } from '../../data/hooks';
import { settingsRepo } from '../../data/repositories/settingsRepo';
import { getForecast, getHolidays } from '../../data/services/travelInfo';
import {
  fillHolidays,
  groupHolidaySpans,
  type Holiday,
  type HolidaySpan,
} from '../../domain/holidays';
import type { DayWeather } from '../../domain/weather';

const PREFS_KEY = 'calendarInfo';
export interface CalendarInfoPrefs {
  weather: boolean;
  holidays: boolean;
}
const DEFAULT_PREFS: CalendarInfoPrefs = { weather: true, holidays: true };

// 칩을 빨리 연달아 눌러도 앞의 저장이 끝난 뒤 최신 값을 읽어 바꾼다 (덮어쓰기 방지)
let saving = Promise.resolve();
function toggle(key: keyof CalendarInfoPrefs) {
  saving = saving.then(async () => {
    const cur = await settingsRepo.get(PREFS_KEY, DEFAULT_PREFS);
    await settingsRepo.set(PREFS_KEY, { ...cur, [key]: !cur[key] });
  });
}

export interface CalendarInfo {
  prefs: CalendarInfoPrefs;
  toggle: (key: keyof CalendarInfoPrefs) => void;
  /** 날짜별 공휴일 (한국 + 목적지 나라) — 끄면 비어 있음 */
  holidays: Map<LocalDate, Holiday[]>;
  spans: HolidaySpan[];
  /** 날짜별 예보 (16일 이내) — 끄면 비어 있음 */
  weather: Record<LocalDate, DayWeather>;
  /** 공휴일 정보를 못 받는 나라 (무료 출처 미지원) */
  unsupported: string[];
  /** 날씨를 보여줄 기준 도시 (좌표가 있는 첫 목적지) */
  weatherPlace: string | null;
}

/**
 * 여행 날짜 달력용 공휴일·날씨. 한국 공휴일은 항상, 목적지 나라 공휴일은 함께.
 * years: 달력에 보이는 해들
 */
export function useCalendarInfo(
  destinations: readonly Destination[],
  years: readonly number[],
): CalendarInfo {
  const prefs = useSetting<CalendarInfoPrefs>(PREFS_KEY, DEFAULT_PREFS);
  const countries = useMemo(
    () => [
      ...new Set(['KR', ...destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []))]),
    ],
    [destinations],
  );
  const place = destinations.find((d) => d.coords);
  const [holidayList, setHolidayList] = useState<Holiday[]>([]);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [weather, setWeather] = useState<Record<LocalDate, DayWeather>>({});

  const countryKey = countries.join(',');
  const yearKey = years.join(',');
  useEffect(() => {
    if (!prefs.holidays) return;
    let alive = true;
    const codes = countryKey.split(',');
    const ys = yearKey.split(',').map(Number);
    void Promise.all(
      codes.map(async (cc) => {
        const perYear = await Promise.all(ys.map((y) => getHolidays(cc, y)));
        return { cc, list: perYear.flatMap((l) => l ?? []), unsupported: perYear.includes(null) };
      }),
    ).then((results) => {
      if (!alive) return;
      setHolidayList(fillHolidays(results.flatMap((r) => r.list)));
      setUnsupported(results.filter((r) => r.unsupported).map((r) => r.cc));
    });
    return () => {
      alive = false;
    };
  }, [prefs.holidays, countryKey, yearKey]);

  const lat = place?.coords?.lat;
  const lng = place?.coords?.lng;
  const tz = place?.timezone ?? 'auto';
  useEffect(() => {
    if (!prefs.weather || lat === undefined || lng === undefined) return;
    let alive = true;
    void getForecast(lat, lng, tz).then((w) => {
      if (alive) setWeather(w);
    });
    return () => {
      alive = false;
    };
  }, [prefs.weather, lat, lng, tz]);

  const holidays = useMemo(() => {
    const map = new Map<LocalDate, Holiday[]>();
    if (!prefs.holidays) return map;
    for (const h of holidayList) {
      if (!countries.includes(h.countryCode)) continue;
      map.set(
        h.date,
        [...(map.get(h.date) ?? []), h].sort(
          (a, b) => Number(b.countryCode === 'KR') - Number(a.countryCode === 'KR'),
        ),
      );
    }
    return map;
  }, [holidayList, countries, prefs.holidays]);

  const spans = useMemo(
    () =>
      prefs.holidays
        ? groupHolidaySpans(holidayList.filter((h) => countries.includes(h.countryCode)))
        : [],
    [holidayList, countries, prefs.holidays],
  );

  return {
    prefs,
    toggle,
    holidays,
    spans,
    weather: prefs.weather && place ? weather : {},
    unsupported: prefs.holidays ? unsupported : [],
    weatherPlace: place?.name ?? null,
  };
}
