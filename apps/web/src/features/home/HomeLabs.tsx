import { todayIn, type Booking, type ItineraryItem, type Trip } from '@trippocket/shared';
import { useLab } from '../../data/labsStore';
import { flightInAir, hoursAhead, todayBrief } from '../../domain/travelExtras';
import { useTranslation } from '../../i18n';
import { useMinuteClock } from '../../shared/hooks/useMinuteClock';

/**
 * 홈의 실험실 한 줄들 (2026-10-27, 다른 여행 앱 참고):
 * - 비행 중이면 도착까지 남은 시간 (TripIt)
 * - 여행 중 오늘 요약: 일정 수·첫 일정 (Google 여행)
 * - 출발 전 시차 (Google 여행)
 */
export function HomeLabs({
  trip,
  bookings,
  items,
  ongoing,
}: {
  trip: Trip;
  bookings: readonly Booking[];
  items: readonly ItineraryItem[];
  ongoing: boolean;
}) {
  const { t } = useTranslation();
  const flightOn = useLab('flightProgress');
  const briefOn = useLab('morningBrief');
  const jetLagOn = useLab('jetLag');
  const now = useMinuteClock(flightOn).getTime();
  const air = flightOn ? flightInAir(bookings, trip.timezone, now) : null;
  const today = todayIn(trip.timezone);
  const brief = briefOn && ongoing ? todayBrief(items.filter((i) => i.date === today)) : null;
  const ahead = jetLagOn && !ongoing ? hoursAhead(trip.timezone) : null;
  const lines: string[] = [];
  if (air)
    lines.push(
      t('labs.inAir', {
        name: air.title,
        h: Math.floor(air.minutesLeft / 60),
        m: air.minutesLeft % 60,
      }),
    );
  if (brief && brief.count > 0)
    lines.push(
      brief.first
        ? t('labs.briefFirst', { n: brief.count, time: brief.first })
        : t('labs.brief', { n: brief.count }),
    );
  if (ahead !== null)
    lines.push(
      ahead === 0
        ? t('labs.jetLagSame')
        : t(ahead > 0 ? 'labs.jetLagAhead' : 'labs.jetLagBehind', { h: Math.abs(ahead) }),
    );
  if (!lines.length) return null;
  return (
    <ul aria-label={t('labs.homeLabel')} className="flex flex-col gap-1">
      {lines.map((l) => (
        <li key={l} className="rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
          {l}
        </li>
      ))}
    </ul>
  );
}
