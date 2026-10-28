import { todayIn, type Booking, type LocalDate, type Trip } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { useTrips } from '../../data/hooks';
import { useLab } from '../../data/labsStore';
import { getHolidays } from '../../data/services/travelInfo';
import { useSettings } from '../../data/settingsStore';
import { fillHolidays } from '../../domain/holidays';
import { cancelSoon, firstVisitCountries, leaveDaysNeeded } from '../../domain/localInfo';
import { hoursAhead } from '../../domain/travelExtras';
import { useTranslation } from '../../i18n';

const countryName = (cc: string) => {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
};

/** 한국 공휴일 (필요한 연차 계산용 — 켰을 때만 받는다) */
function useKrHolidays(on: boolean, years: string): ReadonlySet<LocalDate> | null {
  const [out, setOut] = useState<ReadonlySet<LocalDate> | null>(null);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    void Promise.all(years.split(',').map((y) => getHolidays('KR', Number(y)))).then((lists) => {
      if (alive) setOut(new Set(fillHolidays(lists.flatMap((l) => l ?? [])).map((h) => h.date)));
    });
    return () => {
      alive = false;
    };
  }, [on, years]);
  return on ? out : null;
}

/**
 * 홈 여행 카드 아래 도움 줄:
 * - 출발 전 시차 (설정 "일정" — 2026-10-28 실험실에서 정식, Google 여행 참고)
 * - 실험실 3차 (2026-10-28): 필요한 연차·처음 가는 나라(출발 전), 무료 취소 마감(언제나)
 */
export function HomeLabs({
  trip,
  bookings,
  ongoing,
}: {
  trip: Trip;
  bookings: readonly Booking[];
  ongoing: boolean;
}) {
  const { t } = useTranslation();
  const jetLagOn = useSettings((s) => s.jetLag);
  const leaveOn = useLab('leaveDays') && !ongoing;
  const firstOn = useLab('firstCountry') && !ongoing;
  const cancelOn = useLab('cancelReminder');
  const trips = useTrips();
  const years = [...new Set([trip.startDate.slice(0, 4), trip.endDate.slice(0, 4)])].join(',');
  const krHolidays = useKrHolidays(leaveOn, years);
  const today = todayIn(trip.timezone);

  const lines: string[] = [];
  const ahead = jetLagOn && !ongoing ? hoursAhead(trip.timezone) : null;
  if (ahead !== null)
    lines.push(
      ahead === 0
        ? t('labs.jetLagSame')
        : t(ahead > 0 ? 'labs.jetLagAhead' : 'labs.jetLagBehind', { h: Math.abs(ahead) }),
    );
  if (leaveOn && krHolidays) {
    const n = leaveDaysNeeded(trip.startDate, trip.endDate, krHolidays);
    lines.push(n > 0 ? t('labs.leaveDays', { n }) : t('labs.leaveNone'));
  }
  if (firstOn && trips) {
    const first = firstVisitCountries(trip, trips, today);
    if (first.length)
      lines.push(t('labs.firstCountry', { country: first.map(countryName).join('·') }));
  }
  if (cancelOn)
    for (const c of cancelSoon(bookings, today))
      lines.push(
        c.d === 0
          ? t('labs.cancelToday', { name: c.name })
          : t('labs.cancelSoon', { d: c.d, name: c.name }),
      );
  if (!lines.length) return null;
  return (
    <ul aria-label={t('labs.homeLabel')} className="flex flex-col gap-1">
      {lines.map((l, i) => (
        <li
          key={`${i}-${l}`}
          className="rounded-btn bg-bg-subtle px-3 py-2 text-caption whitespace-pre-line text-fg-sub"
        >
          {l}
        </li>
      ))}
    </ul>
  );
}
