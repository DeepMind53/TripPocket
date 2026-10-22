import { findCountry, flagEmoji, type Destination, type LocalDate } from '@trippocket/shared';
import { CalendarDays, CloudSun } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { holidayFullName, holidayShortName } from '../../domain/holidays';
import { formatTemps, weatherLook } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import type { DateRange } from '../../shared/lib/dateRange';
import { Chip, DateRangePicker, type DayNote } from '../../shared/ui';
import { useTrips } from '../../data/hooks';
import { useCalendarInfo } from './useCalendarInfo';

interface TripCalendarProps {
  destinations: readonly Destination[];
  value: DateRange;
  onChange: (next: DateRange) => void;
  today: LocalDate;
  from?: LocalDate | undefined;
  /** 여행 설정에서 고칠 때 자기 자신은 '다른 여행'으로 보이지 않게 */
  excludeTripId?: string | undefined;
}

/** 여행 날짜 달력 + 공휴일·날씨 (위쪽 칩으로 켜고 끔) */
export function TripCalendar({
  destinations,
  value,
  onChange,
  today,
  from,
  excludeTripId,
}: TripCalendarProps) {
  const { t } = useTranslation();
  const firstYear = Number((from && from < today ? from : today).slice(0, 4));
  const lastYear = Number(today.slice(0, 4)) + 1;
  const years = useMemo(
    () => Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i),
    [firstYear, lastYear],
  );
  const info = useCalendarInfo(destinations, years);
  const { prefs, toggle, holidays, weather, spans } = info;

  // 이미 잡힌 다른 여행 (겹치는 일정 방지)
  const trips = useTrips();
  const others = useMemo(
    () => (trips ?? []).filter((tr) => tr.id !== excludeTripId),
    [trips, excludeTripId],
  );
  const tripOn = useCallback(
    (date: LocalDate) => others.find((tr) => tr.startDate <= date && date <= tr.endDate),
    [others],
  );

  const annotate = useCallback(
    (date: LocalDate): DayNote | undefined => {
      const hs = holidays.get(date);
      const w = weather[date];
      const tr = tripOn(date);
      if (!hs && !w && !tr) return undefined;
      const look = w && weatherLook(w.code);
      return {
        trip: !!tr,
        tripTitle: tr && (date === tr.startDate || date.endsWith('-01')) ? tr.title : undefined,
        holiday: hs?.[0] && holidayShortName(hs[0]),
        weather: look?.kind,
        temps: w && formatTemps(w),
        description: [
          ...(hs ?? []).map((h) => holidayFullName(h)),
          ...(w && look ? [`${look.label} ${formatTemps(w)}`] : []),
          ...(tr ? [t('calendarInfo.otherTrip', { title: tr.title })] : []),
        ].join(', '),
      };
    },
    [holidays, weather, tripOn, t],
  );

  const monthFooter = useCallback(
    (monthKey: string) => {
      const inMonth = (s: { start: string; end: string }) =>
        s.start.slice(0, 7) <= monthKey && monthKey <= s.end.slice(0, 7);
      const list = spans.filter((s) => inMonth({ start: s.start, end: s.end }));
      const tripList = others.filter((tr) => inMonth({ start: tr.startDate, end: tr.endDate }));
      if (list.length === 0 && tripList.length === 0) return null;
      return (
        <ul className="flex flex-col gap-0.5 px-1 pt-2 text-[11px] leading-4 text-fg-sub">
          {tripList.map((tr) => (
            <li key={tr.id} className="flex min-w-0 gap-1.5">
              <span aria-hidden="true">{tr.cover.emoji ?? '🧳'}</span>
              <span className="tabular shrink-0 font-semibold">
                {formatMonthDay(tr.startDate)}–{formatMonthDay(tr.endDate)}
              </span>
              <span className="min-w-0 truncate">
                {t('calendarInfo.otherTrip', { title: tr.title })}
              </span>
            </li>
          ))}
          {list.map((s) => (
            <li key={`${s.countryCode}${s.start}`} className="flex min-w-0 gap-1.5">
              <span aria-hidden="true">{flagEmoji(s.countryCode)}</span>
              <span className="tabular shrink-0 text-danger">
                {formatMonthDay(s.start)}
                {s.end !== s.start && `–${formatMonthDay(s.end)}`}
              </span>
              <span className="min-w-0">{holidayFullName(s.holiday)}</span>
            </li>
          ))}
        </ul>
      );
    },
    [spans, others, t],
  );

  const notes: string[] = [];
  if (prefs.weather)
    notes.push(
      info.weatherPlace
        ? t('calendarInfo.weatherNote', { place: info.weatherPlace })
        : t('calendarInfo.weatherNoPlace'),
    );
  if (info.unsupported.length > 0)
    notes.push(
      t('calendarInfo.holidayUnsupported', {
        countries: info.unsupported.map((cc) => findCountry(cc)?.ko ?? cc).join('·'),
      }),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Chip
            selected={prefs.weather}
            leading={<CloudSun aria-hidden="true" className="size-4" />}
            onClick={() => toggle('weather')}
          >
            {t('calendarInfo.weather')}
          </Chip>
          <Chip
            selected={prefs.holidays}
            leading={<CalendarDays aria-hidden="true" className="size-4" />}
            onClick={() => toggle('holidays')}
          >
            {t('calendarInfo.holidays')}
          </Chip>
        </div>
        {/* 안내는 늘 두 줄 높이를 차지해 정보가 늦게 오거나 칩을 바꿔도 달력이 밀리지 않게 한다 */}
        <p className="line-clamp-2 h-8 text-caption leading-4 text-fg-muted">{notes.join(' · ')}</p>
      </div>
      <DateRangePicker
        value={value}
        onChange={onChange}
        today={today}
        from={from}
        annotate={prefs.weather || prefs.holidays || others.length > 0 ? annotate : undefined}
        monthFooter={monthFooter}
      />
    </div>
  );
}
