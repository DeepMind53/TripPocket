import { dayNumberOf, todayIn, type Trip } from '@trippocket/shared';
import { Link } from 'react-router';
import { useChecklist, useTripBookings, useTripItems } from '../../data/hooks';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { formatTripBadge } from '../../shared/lib/dateFormat';
import { RouteBar } from '../../shared/ui';

/**
 * 여행 중 대표 여행 한 줄 띠 (docs/29 §7.1, 사용자 결정 Q2): 이모지 · 제목 · N일차 + 노선 막대(Q7).
 * 여행 중 민트(2026-11-06 요청)는 이모지 칸과 배지에 남기고, 카드는 조용하게 — 아래 파란 다음 일정이 주인공.
 * 홈과 여행 모드가 같이 쓴다 (사용자 요청 2026-11-13). 여행 모드에서는 일정 화면이 다시 여행 모드로 돌아오므로 링크 없이
 */
export function TripStrip({ trip, link = true }: { trip: Trip; link?: boolean }) {
  const { t } = useTranslation();
  const items = useTripItems(trip.id) ?? [];
  const bookings = useTripBookings(trip.id) ?? [];
  const packing = useChecklist(trip.id, 'packing') ?? [];
  const packed = packing.filter((p) => p.checked).length;
  const today = todayIn(trip.timezone);
  const total = dayNumberOf(trip.startDate, trip.endDate, trip.endDate) ?? 1;
  const day = dayNumberOf(trip.startDate, trip.endDate, today) ?? 1;
  const badge = formatTripBadge(trip.startDate, trip.endDate, today);
  const body = (
    <>
      <span className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-btn bg-mint text-[22px] leading-none"
        >
          {trip.cover.emoji ?? '🧳'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-1 font-semibold">{trip.title}</span>
          <span className="tabular truncate text-caption text-fg-muted">
            {t('home.itemCount', { n: items.length })} ·{' '}
            {t('home.bookingCount', { n: bookings.length })}
            {packing.length > 0 &&
              ` · ${t('home.checklistProgress', { done: packed, total: packing.length })}`}
          </span>
        </span>
        <span className="tabular shrink-0 rounded-full bg-mint px-2.5 py-0.5 text-caption font-semibold text-white">
          {badge}
        </span>
      </span>
      <RouteBar days={total} todayIndex={day - 1} pastBefore={day - 1} label={badge} />
    </>
  );
  const cls =
    'flex flex-col gap-2 rounded-card border border-line bg-surface px-4 py-3 shadow-card';
  return link ? (
    <Link to={`/trips/${trip.id}/plan`} className={cn(cls, 'active:bg-bg-subtle')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
