import { BackupReminder } from '../backup/BackupReminder';
import { useTimeText } from '../../shared/hooks/useTimeText';
import {
  addDays,
  dayNumberOf,
  getTripStatus,
  daysUntil,
  todayIn,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';
import { BedDouble, Check, CircleHelp, Copy, Navigation, Plus } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { Link, useNavigate } from 'react-router';
import { useChecklist, useTripBookings, useTripItems, useTrips } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import {
  currentItem,
  lodgingForNight,
  minutesUntil,
  nextItem,
  nowTimeIn,
} from '../../domain/lodging';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { copyText } from '../../shared/lib/clipboard';
import { cn } from '../../shared/lib/cn';
import { formatPeriod, formatTripBadge, formatTripLength } from '../../shared/lib/dateFormat';
import type { Destination } from '../../shared/lib/directions';
import { Button, EmptyState, toast } from '../../shared/ui';
import { Wordmark } from './Wordmark';
import { TripList } from '../trips/TripsPage';

const PrepCards = lazy(async () => ({ default: (await import('./PrepCards')).PrepCards }));
import { openDirectionsDirect } from '../common/openDirections';
import { isDomesticTrip } from '../../domain/tripPlace';

// 길찾기 시트(이동수단 고르기)는 누를 때 불러온다 — 첫 화면 크기
const DirectionsSheet = lazy(async () => ({
  default: (await import('../common/DirectionsSheet')).DirectionsSheet,
}));

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

  return (
    <>
      {/* 홈만 가운데 로고 (빠른 메뉴는 AppShell의 플로팅 버튼) */}
      <header className="sticky top-0 z-20 grid min-h-[calc(56px+var(--safe-top))] pt-[var(--safe-top)] grid-cols-[72px_1fr_72px] items-center bg-bg/95 px-1 backdrop-blur">
        <span />
        <Wordmark label={t('app.name')} />
        {/* 앱 소개 다시 보기 (사용자 요청 2026-10-26) */}
        <Link
          to="/help"
          className="flex min-h-11 items-center justify-center gap-1 justify-self-end rounded-btn px-2 text-caption font-semibold text-fg-sub active:bg-bg-subtle"
        >
          <CircleHelp aria-hidden="true" className="size-4" />
          {t('help.title')}
        </Link>
      </header>
      {trips && !featured && (
        <EmptyState
          emoji="🧳"
          title={t('home.emptyTitle')}
          description={t('home.emptyDesc')}
          action={
            <div className="flex flex-col items-center gap-2">
              <Button size="lg" onClick={() => void navigate('/trips/new')}>
                {t('home.emptyCta')}
              </Button>
              {/* 처음 쓰는 사람: 샘플로 둘러보기 (docs/16 G1, 사용자 결정 2026-10-24) — 지우면 그만 */}
              <Button
                variant="ghost"
                onClick={() =>
                  void import('../../data/dev')
                    .then((m) => m.seedSampleTrip())
                    .then((id) => {
                      toast(t('home.sampleCreated'));
                      void navigate(`/trips/${id}/plan`);
                    })
                }
              >
                {t('home.sampleCta')}
              </Button>
            </div>
          }
        />
      )}
      <div className="flex flex-col gap-4 px-5 pt-2">
        <BackupReminder
          firstDataAt={(trips ?? []).reduce<string | null>(
            (min, tr) => (min === null || tr.createdAt < min ? tr.createdAt : min),
            null,
          )}
        />
        {ongoing && <OngoingTrip trip={ongoing} />}
        {!ongoing && upcoming && <UpcomingTrip trip={upcoming} />}
        {/* 출발 30일 전부터 준비 현황 (docs/16 B1) — 필요할 때 불러온다 */}
        {!ongoing &&
          upcoming &&
          daysUntil(upcoming.startDate, todayIn(upcoming.timezone)) <= 30 && (
            <Suspense fallback={null}>
              <PrepCards trip={upcoming} />
            </Suspense>
          )}
      </div>
      {/* 내 여행 (여행 중·다가오는) — 예전 "내 여행" 탭을 홈으로 (사용자 요청 2026-10-24) */}
      {featured && (
        <section aria-label={t('home.myTrips')} className="flex flex-col gap-2 pt-6">
          <div className="flex items-center justify-between px-5">
            <h2 className="text-body-1 font-bold">{t('home.myTrips')}</h2>
            <Button
              size="sm"
              variant="ghost"
              leading={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => void navigate('/trips/new')}
            >
              {t('home.newTrip')}
            </Button>
          </div>
          <TripList only="active" exclude={featured?.id} />
        </section>
      )}
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
  // 지금 하고 있을 일정 (시작은 지났고 아직 안 다녀옴) — docs/20 U2
  const current = currentItem(todayItems, now);
  // 오늘 다 끝나면 내일 첫 일정
  const tomorrow = addDays(today, 1);
  const tomorrowFirst =
    !next && tomorrow <= trip.endDate
      ? ((items ?? []).find((i) => i.date === tomorrow && !i.done) ?? null)
      : null;
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

      {current && current.id !== next?.id && (
        <section
          aria-label={t('home.currentItem')}
          className="flex items-center gap-3 rounded-card border border-primary/40 bg-primary-weak px-4 py-3"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="tabular text-caption font-semibold text-primary">
              {t('home.currentItem')} · {time(current.startTime)}
            </span>
            <span className="truncate text-body-1 font-semibold">{current.title}</span>
          </span>
          <button
            type="button"
            onClick={() => void itemRepo.update(current.id, { done: true })}
            className="flex h-10 shrink-0 items-center gap-1 rounded-btn bg-surface px-3 text-caption font-semibold text-primary"
          >
            <Check aria-hidden="true" className="size-4" />
            {t('home.markDone')}
          </button>
          <button
            type="button"
            aria-label={t('home.directionsTo', { name: current.title })}
            onClick={() =>
              directions({
                name: current.title,
                address: current.place?.address,
                coords: current.place?.coords,
              })
            }
            className="grid size-10 shrink-0 place-items-center rounded-btn bg-surface text-primary"
          >
            <Navigation aria-hidden="true" className="size-4" />
          </button>
        </section>
      )}

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
          <div className="flex flex-col gap-1 rounded-card bg-bg-subtle p-4 text-body-2 text-fg-sub">
            <p>{todayItems.length === 0 ? t('home.noItemsToday') : t('home.allDone')}</p>
            {tomorrowFirst && (
              <Link
                to={`/trips/${trip.id}/plan?day=${day + 1}`}
                className="tabular font-semibold text-primary"
              >
                {t('home.tomorrowFirst', {
                  time: time(tomorrowFirst.startTime) ?? '',
                  title: tomorrowFirst.title,
                })}
              </Link>
            )}
          </div>
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

      {dirOpen && (
        <Suspense fallback={null}>
          <DirectionsSheet
            open={dirOpen}
            onOpenChange={setDirOpen}
            destination={dest}
            isDomestic={isDomesticTrip(trip)}
          />
        </Suspense>
      )}
    </>
  );
}
