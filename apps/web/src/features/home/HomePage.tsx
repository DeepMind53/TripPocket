import { useTimeText } from '../../shared/hooks/useTimeText';
import {
  dayNumberOf,
  getTripStatus,
  todayIn,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';
import { BedDouble, Check, ChevronRight, Copy, Navigation } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { Link, useNavigate } from 'react-router';
import { useChecklist, useTripBookings, useTripItems, useTrips } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { lodgingForNight, minutesUntil, nextItem, nowTimeIn } from '../../domain/lodging';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { copyText } from '../../shared/lib/clipboard';
import { cn } from '../../shared/lib/cn';
import { formatPeriod, formatTripBadge, formatTripLength } from '../../shared/lib/dateFormat';
import type { Destination } from '../../shared/lib/directions';
import { Button, EmptyState } from '../../shared/ui';
import { Wordmark } from './Wordmark';
import { DirectionsSheet } from '../common/DirectionsSheet';
import { openDirectionsDirect } from '../common/openDirections';
import { QuickMenuButton } from '../common/QuickMenu';
import { isDomesticTrip } from '../../domain/tripPlace';

/** 1분마다 다시 그려 "35분 후"를 갱신한다 */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
}

/**
 * S-01 홈 — 앱을 열면 3초 안에 다음 일정·숙소·예약번호 (docs/11 §2)
 * 여행 중 > 다가오는 여행 > 빈 화면 순으로 보여준다.
 */
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const trips = useTrips();

  const withStatus = (trips ?? []).map((trip) => ({
    trip,
    status: getTripStatus(trip.startDate, trip.endDate, todayIn(trip.timezone)),
  }));
  const ongoing = withStatus.find((x) => x.status === 'ongoing')?.trip;
  const upcoming = withStatus.find((x) => x.status === 'upcoming')?.trip;
  const featured = ongoing ?? upcoming;
  const others = withStatus.filter((x) => x.status !== 'past').length - (featured ? 1 : 0);

  return (
    <>
      {/* 홈만 가운데 로고. 빠른 메뉴 버튼은 다른 화면과 같은 오른쪽 위치 */}
      <header className="sticky top-[env(safe-area-inset-top)] z-20 grid min-h-14 grid-cols-[44px_1fr_44px] items-center bg-bg/95 px-1 backdrop-blur">
        <span />
        <Wordmark label={t('app.name')} />
        <QuickMenuButton />
      </header>
      {trips && !featured && (
        <EmptyState
          emoji="🧳"
          title={t('home.emptyTitle')}
          description={t('home.emptyDesc')}
          action={
            <Button size="lg" onClick={() => void navigate('/trips/new')}>
              {t('home.emptyCta')}
            </Button>
          }
        />
      )}
      <div className="flex flex-col gap-4 px-5 pt-2">
        {ongoing && <OngoingTrip trip={ongoing} />}
        {!ongoing && upcoming && <UpcomingTrip trip={upcoming} />}
        {others > 0 && (
          <Link
            to="/trips"
            className="flex items-center justify-center gap-1 py-2 text-body-2 font-semibold text-fg-sub"
          >
            {t('home.otherTrips', { n: others })}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
    </>
  );
}

function UpcomingTrip({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const items = useTripItems(trip.id) ?? [];
  const bookings = useTripBookings(trip.id) ?? [];
  const packing = useChecklist(trip.id, 'packing') ?? [];
  const packed = packing.filter((p) => p.checked).length;
  return (
    <Link
      to={`/trips/${trip.id}/plan`}
      className="flex flex-col gap-3 rounded-card p-5 text-white shadow-card"
      style={{ background: trip.cover.color ?? '#2F6BFF' }}
    >
      <span className="tabular self-start rounded-full bg-white/20 px-2.5 py-0.5 text-caption font-bold">
        {formatTripBadge(trip.startDate, trip.endDate, todayIn(trip.timezone))}
      </span>
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="text-[40px] leading-none">
          {trip.cover.emoji ?? '🧳'}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-title-1">{trip.title}</span>
          <span className="tabular text-body-2 opacity-90">
            {t('home.upcomingDesc', {
              period: formatPeriod(trip.startDate, trip.endDate),
              length: formatTripLength(trip.startDate, trip.endDate),
            })}
          </span>
        </span>
      </span>
      <span className="text-caption opacity-90">
        {t('home.itemCount', { n: items.length })} ·{' '}
        {t('home.bookingCount', { n: bookings.length })}
        {packing.length > 0 &&
          ` · ${t('home.checklistProgress', { done: packed, total: packing.length })}`}
      </span>
    </Link>
  );
}

function OngoingTrip({ trip }: { trip: Trip }) {
  const { time, wide } = useTimeText();
  const { t } = useTranslation();
  useMinuteTick();
  const items = useTripItems(trip.id);
  const bookings = useTripBookings(trip.id) ?? [];
  const [dirOpen, setDirOpen] = useRouteSheet('directions');
  const [dest, setDest] = useState<Destination | null>(null);

  const today = todayIn(trip.timezone);
  const day = dayNumberOf(trip.startDate, trip.endDate, today) ?? 1;
  const todayItems = (items ?? []).filter((i) => i.date === today);
  const now = nowTimeIn(trip.timezone);
  const next = nextItem(todayItems, now);
  const lodging = lodgingForNight(bookings, today);
  const planUrl = `/trips/${trip.id}/plan?day=${day}`;

  function directions(d: Destination) {
    if (openDirectionsDirect(d)) return;
    setDest(d);
    setDirOpen(true);
  }

  function countdown(item: ItineraryItem): string | null {
    if (!item.startTime) return null;
    const m = minutesUntil(now, item.startTime);
    if (m <= 0) return t('home.now');
    if (m < 60) return t('home.inMinutes', { n: m });
    return t('home.inHours', { h: Math.floor(m / 60), m: m % 60 });
  }

  return (
    <>
      <Link to={planUrl} className="flex items-center gap-2">
        <span aria-hidden="true" className="text-[22px]">
          {trip.cover.emoji ?? '🧳'}
        </span>
        <span className="min-w-0 flex-1 truncate text-body-1">{trip.title}</span>
        <span className="tabular shrink-0 rounded-full bg-primary-weak px-2 py-0.5 text-micro text-primary">
          {formatTripBadge(trip.startDate, trip.endDate, today)}
        </span>
      </Link>

      {next ? (
        <section
          aria-label={t('home.nextItem')}
          className="flex flex-col gap-2 rounded-card bg-primary p-4 text-on-primary"
        >
          <p className="tabular text-caption opacity-90">
            {t('home.nextItem')}
            {countdown(next) && ` · ${countdown(next)}`}
          </p>
          <p className="text-title-2">{next.title}</p>
          {(next.startTime || next.place?.address) && (
            <p className="tabular truncate text-caption opacity-90">
              {[next.startTime, next.place?.address].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() =>
                directions({
                  name: next.title,
                  address: next.place?.address,
                  coords: next.place?.coords,
                })
              }
              className="flex h-10 items-center gap-1.5 rounded-btn bg-white/20 px-3 text-caption font-semibold"
            >
              <Navigation aria-hidden="true" className="size-4" />
              {t('home.directions')}
            </button>
            <Link
              to={planUrl}
              className="flex h-10 items-center rounded-btn bg-white/20 px-3 text-caption font-semibold"
            >
              {t('home.viewPlan')}
            </Link>
          </div>
        </section>
      ) : (
        items && (
          <p className="rounded-card bg-bg-subtle p-4 text-body-2 text-fg-sub">
            {todayItems.length === 0 ? t('home.noItemsToday') : t('home.allDone')}
          </p>
        )
      )}

      {todayItems.length > 0 && (
        <section
          aria-label={t('home.todayItems', { n: todayItems.length })}
          className="flex flex-col"
        >
          <h2 className="mb-1 text-caption font-bold text-fg-muted">
            {t('home.todayItems', { n: todayItems.length })}
          </h2>
          <ul className="flex flex-col">
            {todayItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-1.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done ?? false}
                  aria-label={item.title}
                  onClick={() => void itemRepo.update(item.id, { done: !item.done })}
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full border-2',
                    item.done ? 'border-success bg-success text-white' : 'border-line',
                  )}
                >
                  {item.done && <Check aria-hidden="true" className="size-3.5" />}
                </button>
                <span
                  className={cn(
                    'tabular shrink-0 text-caption text-fg-sub',
                    wide ? 'w-16' : 'w-11',
                  )}
                >
                  {time(item.startTime) ?? '—'}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-body-2',
                    item.done && 'text-fg-muted line-through',
                    item.id === next?.id && 'font-bold',
                  )}
                >
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lodging && (
        <section
          aria-label={t('home.lodgingTonight')}
          className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
        >
          <p className="flex items-center gap-2 text-caption font-bold text-fg-muted">
            <BedDouble aria-hidden="true" className="size-4 text-day-4" />
            {t('home.lodgingTonight')}
            <span className="tabular font-medium">
              {lodging.night}/{lodging.nights}
            </span>
          </p>
          <p className="text-body-1">{lodging.booking.title}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              leading={<Navigation aria-hidden="true" className="size-4" />}
              onClick={() =>
                directions({
                  name: lodging.booking.title,
                  address: lodging.booking.details?.address,
                })
              }
            >
              {t('home.directions')}
            </Button>
            {lodging.booking.confirmationNo && (
              <Button
                size="sm"
                variant="secondary"
                className="tabular"
                leading={<Copy aria-hidden="true" className="size-4" />}
                aria-label={t('bookings.copyNo', { no: lodging.booking.confirmationNo })}
                onClick={() =>
                  void copyText(lodging.booking.confirmationNo as string, t('bookings.copied'))
                }
              >
                {lodging.booking.confirmationNo}
              </Button>
            )}
          </div>
        </section>
      )}

      <DirectionsSheet
        open={dirOpen}
        onOpenChange={setDirOpen}
        destination={dest}
        isDomestic={isDomesticTrip(trip)}
      />
    </>
  );
}
