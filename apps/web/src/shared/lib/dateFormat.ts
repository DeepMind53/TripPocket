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

/** 날짜 표시 형식 (설정 dateFormat) — settingsStore가 바뀔 때마다 알려 준다 */
let style: 'dot' | 'korean' = 'dot';
export function setDateStyle(next: 'dot' | 'korean'): void {
  style = next;
}

export function weekdayChar(date: LocalDate): string {
  return i18n.t('date.weekdayChars').charAt(weekday(date));
}

/** "10.24 (금)" */
/** "09:30" → 24시간이면 그대로, 12시간이면 "오전 9:30" */
export function formatTime(time: string, format: '24h' | '12h'): string {
  if (format === '24h') return time;
  const [h = 0, m = 0] = time.split(':').map(Number);
  const half = h < 12 ? i18n.t('date.am') : i18n.t('date.pm');
  return `${half} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`;
}

/** "10.24 (금)" 또는 "10월 24일 (금)" */
export function formatMonthDay(date: LocalDate): string {
  const { m, d } = parts(date);
  return style === 'korean'
    ? i18n.t('date.monthDayKo', { m: Number(m), d: Number(d), w: weekdayChar(date) })
    : i18n.t('date.monthDay', { m, d, w: weekdayChar(date) });
}

/** "2026.10.24 – 10.28" (연도가 다르면 끝에도 연도) */
export function formatPeriod(start: LocalDate, end: LocalDate): string {
  const s = parts(start);
  const e = parts(end);
  if (style === 'korean') {
    const ko = (p: { y: string; m: string; d: string }, year: boolean) =>
      i18n.t(year ? 'date.fullDateKo' : 'date.monthDayShortKo', {
        y: p.y,
        m: Number(p.m),
        d: Number(p.d),
      });
    return i18n.t('date.period', { start: ko(s, true), end: ko(e, s.y !== e.y) });
  }
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
