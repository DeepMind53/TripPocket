import { todayIn, type LocalDate, type Trip } from '@trippocket/shared';
import { CalendarClock, History, Thermometer, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTrips } from '../../data/hooks';
import { useLabs } from '../../data/labsStore';
import { getForecast, getHolidays } from '../../data/services/travelInfo';
import { holidayShortName } from '../../domain/holidays';
import { earlierTripTo, krHolidaysNear, tempDiff } from '../../domain/tripHints';
import type { DayWeather } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { InlineIcon } from '../../shared/ui/InlineIcon';
import { useTripWeather } from '../common/useTripWeather';

/** 서울 시청 (기온 비교 기준 — 보내는 정보는 이 고정 좌표뿐) */
const SEOUL = { lat: 37.57, lng: 126.98 };

/**
 * 출발 전 홈 여행 카드 아래 실험 3개 (2026-11-13): 다시 찾은 도시 · 서울과 기온 비교 · 한국 연휴 겹침.
 * 기온은 무료 Open-Meteo 예보(이미 쓰는 것), 연휴는 공휴일 저장값 (켰을 때만 받는다)
 */
export function UpcomingLabs({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const labs = useLabs();
  const trips = useTrips();
  const dest = useTripWeather(labs.weatherVsSeoul ? trip : undefined);
  const [seoul, setSeoul] = useState<Record<LocalDate, DayWeather>>({});
  const [kr, setKr] = useState<Record<LocalDate, string>>({});
  const domestic = trip.destinations.every((d) => d.countryCode === 'KR');

  useEffect(() => {
    if (!labs.weatherVsSeoul || domestic) return;
    let alive = true;
    void getForecast(SEOUL.lat, SEOUL.lng, 'Asia/Seoul').then((w) => alive && setSeoul(w));
    return () => {
      alive = false;
    };
  }, [labs.weatherVsSeoul, domestic]);

  const years = [...new Set([trip.startDate.slice(0, 4), trip.endDate.slice(0, 4)])].join(',');
  useEffect(() => {
    if (!labs.krHolidayRush) return;
    let alive = true;
    void Promise.all(years.split(',').map((y) => getHolidays('KR', Number(y)))).then((lists) => {
      if (!alive) return;
      const map: Record<LocalDate, string> = {};
      for (const h of lists.flatMap((l) => l ?? [])) map[h.date] ??= holidayShortName(h);
      setKr(map);
    });
    return () => {
      alive = false;
    };
  }, [labs.krHolidayRush, years]);

  const lines: { icon: LucideIcon; text: string }[] = [];
  if (labs.revisitCity && trips) {
    const before = earlierTripTo(trip, trips);
    if (before)
      lines.push({
        icon: History,
        text: t('hint.revisit', {
          date: before.startDate.slice(0, 7).replace('-', '.'),
          title: before.title,
        }),
      });
  }
  // 출발일 기온 (예보가 있는 날만 — 작년 기록은 빼고)
  const day = trip.startDate >= todayIn(trip.timezone) ? trip.startDate : todayIn(trip.timezone);
  const d = dest[day];
  const s = seoul[day];
  if (labs.weatherVsSeoul && !domestic && d && !d.year && s) {
    const diff = tempDiff(d, s);
    lines.push({
      icon: Thermometer,
      text:
        Math.abs(diff) < 3
          ? t('hint.tempSame')
          : t(diff > 0 ? 'hint.tempWarmer' : 'hint.tempColder', { n: Math.abs(diff) }),
    });
  }
  if (labs.krHolidayRush) {
    const names = krHolidaysNear(trip, kr);
    if (names.length)
      lines.push({ icon: CalendarClock, text: t('hint.krHoliday', { names: names.join('·') }) });
  }
  if (!lines.length) return null;
  return (
    <ul aria-label={t('hint.upcomingLabel')} className="flex flex-col gap-1">
      {lines.map((l) => (
        <li
          key={l.text}
          className="rounded-btn bg-bg-subtle px-3 py-2 text-caption whitespace-pre-line text-fg-sub"
        >
          <InlineIcon icon={l.icon} />
          {l.text}
        </li>
      ))}
    </ul>
  );
}
