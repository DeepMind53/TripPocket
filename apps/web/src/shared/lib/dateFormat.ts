import {
  dayNumberOf,
  daysUntil,
  getTripStatus,
  nightsBetween,
  weekday,
  type LocalDate,
} from '@trippocket/shared';
import i18n from '../../i18n';

// 날짜 표기 규칙: docs/11-design-system.md §9.1

const parts = (date: LocalDate) => {
  const [y, m, d] = date.split('-');
  return { y: y ?? '', m: m ?? '', d: d ?? '' };
};

export function weekdayChar(date: LocalDate): string {
  return i18n.t('date.weekdayChars').charAt(weekday(date));
}

/** "10.24 (금)" */
export function formatMonthDay(date: LocalDate): string {
  const { m, d } = parts(date);
  return i18n.t('date.monthDay', { m, d, w: weekdayChar(date) });
}

/** "2026.10.24 – 10.28" (연도가 다르면 끝에도 연도) */
export function formatPeriod(start: LocalDate, end: LocalDate): string {
  const s = parts(start);
  const e = parts(end);
  const startText = i18n.t('date.fullDate', s);
  const endText = s.y === e.y ? `${e.m}.${e.d}` : i18n.t('date.fullDate', e);
  return i18n.t('date.period', { start: startText, end: endText });
}

/** "4박 5일" / "당일치기" */
export function formatTripLength(start: LocalDate, end: LocalDate): string {
  const nights = nightsBetween(start, end);
  return nights === 0
    ? i18n.t('date.dayTrip')
    : i18n.t('date.nightsDays', { nights, days: nights + 1 });
}

/** "D-3" / "D-DAY" / "여행 중 · 2일차" / "다녀온 여행" */
export function formatTripBadge(start: LocalDate, end: LocalDate, today: LocalDate): string {
  const status = getTripStatus(start, end, today);
  if (status === 'past') return i18n.t('date.past');
  if (status === 'ongoing') {
    const n = dayNumberOf(start, end, today) ?? 1;
    return n === 1 && start === today ? i18n.t('date.ddayToday') : i18n.t('date.ongoing', { n });
  }
  return i18n.t('date.dday', { n: daysUntil(start, today) });
}
