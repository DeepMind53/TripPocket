import { CalendarCheck, CalendarClock, CalendarRange, type LucideIcon } from 'lucide-react';
import type { TripDayWeather } from '../common/useTripWeather';

/** 날씨 자료 종류: 지난 날(실제 기록) · 예보(2주 안) · 작년 같은 날 기록 (2주 넘게 남은 날) */
export type WeatherKind = 'observed' | 'forecast' | 'lastYear';

export const weatherKind = (w: TripDayWeather): WeatherKind =>
  w.year ? 'lastYear' : w.past ? 'observed' : 'forecast';

/** 종류별 달력 그림·색 (사용자 요청 2026-11-02) */
export const KIND_ICON: Record<WeatherKind, { Icon: LucideIcon; color: string }> = {
  observed: { Icon: CalendarCheck, color: 'text-fg-muted' },
  forecast: { Icon: CalendarClock, color: 'text-primary' },
  lastYear: { Icon: CalendarRange, color: 'text-warning' },
};
