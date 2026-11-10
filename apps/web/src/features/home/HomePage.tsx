import { useLab } from '../../data/labsStore';
import { applyVisit } from '../../data/skippedToSaved';
import { pastItemIds } from '../../domain/dayTools';
import type { Visit } from '../../domain/visit';
import { VisitToggle } from '../common/VisitToggle';
import { SAVED_PLACES_MAX } from '@trippocket/shared';
import { BackupReminder } from '../backup/BackupReminder';
import { useTripPlanItems } from '../itinerary/usePlanView';
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
import { BedDouble, ChevronDown, CircleHelp, Copy, Navigation, Plus, Luggage } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { Link, useNavigate } from 'react-router';
import { useChecklist, useTripBookings, useTripItems, useTrips } from '../../data/hooks';
import { lodgingForNight, minutesUntil, nextItem, nowTimeIn } from '../../domain/lodging';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { copyText } from '../../shared/lib/clipboard';
import { cn } from '../../shared/lib/cn';
import { formatPeriod, formatTripBadge, formatTripLength } from '../../shared/lib/dateFormat';
import type { Destination } from '../../shared/lib/directions';
import {
  Button,
  EmptyState,
  NextStopCard,
  RouteBar,
  RouteLine,
  RouteStop,
  routeColor,
  toast,
} from '../../shared/ui';
import { Wordmark } from './Wordmark';
// 예약 탭과 같은 카드 — 공항 정보·지연·수하물까지 딸려 와 무거워서 출발 전 다음 이동이 있을 때만 불러온다 (첫 화면 크기)
const BookingCard = lazy(async () => ({
  default: (await import('../bookings/BookingCard')).BookingCard,
}));
import { TravelModeButton } from '../travel/TravelModeButton';
import { TripList } from '../trips/TripsPage';

const PrepCards = lazy(async () => ({ default: (await import('./PrepCards')).PrepCards }));
// 여행 중 특보 한 줄 — 첫 화면에 넣지 않고 따로 받는다
// 실험실 한 줄들 — 첫 화면에 넣지 않고 따로 받는다
const HomeLabs = lazy(async () => ({ default: (await import('./HomeLabs')).HomeLabs }));
const TripAlertBanner = lazy(async () => ({
  default: (await import('../weather/TripAlertBanner')).TripAlertBanner,
}));
import { openDirectionsDirect } from '../common/openDirections';
import { isDomesticTrip } from '../../domain/tripPlace';

// 길찾기 시트(이동수단 고르기)는 누를 때 불러온다 — 첫 화면 크기
const DirectionsSheet = lazy(async () => ({
  default: (await import('../common/DirectionsSheet')).DirectionsSheet,
}));

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** 지난 일정 시각 → 다음 일정 시각 사이에서 지금이 어디쯤인지 (0~1, 다음 일정 카드 진행 막대) */
function progressBetween(prev: ItineraryItem, next: ItineraryItem, now: string): number | null {
  if (!prev.startTime || !next.startTime) return null;
  const span = toMin(next.startTime) - toMin(prev.startTime);
  if (span <= 0) return null;
  return (toMin(now) - toMin(prev.startTime)) / span;
}

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
      <header className="sticky top-0 z-20 grid min-h-[calc(56px+var(--safe-top))] pt-[var(--safe-top)] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 bg-bg/95 px-4 backdrop-blur">
        {/* 왼쪽 빈칸: 여행 모드 켜기 (실험실, 사용자 요청 2026-11-04).
            버튼이 없을 때도 칸은 남겨 로고가 늘 가운데에 (아이폰에서 로고가 왼쪽에 붙던 문제, 2026-11-06) */}
        <div className="flex min-w-0 justify-start">
          <TravelModeButton tripId={featured?.id} compact />
        </div>
        <Wordmark label={t('app.name')} />
        {/* 앱 소개 다시 보기 (사용자 요청 2026-10-26) */}
        <Link
          to="/help"
          className="flex min-h-11 items-center justify-center gap-1 justify-self-end rounded-btn px-2 whitespace-nowrap text-caption font-semibold text-fg-sub active:bg-bg-subtle"
        >
          <CircleHelp aria-hidden="true" className="size-4" />
          {t('help.title')}
        </Link>
      </header>
      {trips && !featured && (
        <EmptyState
          icon={Luggage}
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
        {/* 디자인 개편 3단계 (docs/29 §7.1, 사용자 결정 Q1·Q2 2026-11-09): 여행 중에는 여행 카드를 한 줄 띠로 줄이고
            바로 아래 다음 일정 카드·오늘 노선·오늘 숙소. 출발 전에는 여행 카드 + 다음 이동 탑승권 (2026-11-10) */}
        {featured &&
          (ongoing ? <OngoingStrip trip={featured} /> : <UpcomingTrip trip={featured} />)}
        {featured && !ongoing && <NextTransport trip={featured} />}
        {ongoing && <OngoingTrip trip={ongoing} />}
        {/* 출발 30일 전부터 준비 현황 (docs/16 B1) — 여행 중에는 접힌 채로 — 필요할 때 불러온다 */}
        {featured &&
          (ongoing || daysUntil(featured.startDate, todayIn(featured.timezone)) <= 30) && (
            <Suspense fallback={null}>
              <PrepCards trip={featured} collapsed={!!ongoing} />
            </Suspense>
          )}
      </div>
      {/* 내 여행 (여행 중·다가오는) — 예전 "내 여행" 탭을 홈으로 (사용자 요청 2026-10-24) */}
      {featured && (
        <section aria-label={t('home.myTrips')} className="flex flex-col gap-2 pt-6">
          <div className="flex items-center justify-between px-5">
            <h2 className="text-body-1 font-semibold">{t('home.myTrips')}</h2>
            <Button
              size="sm"
              variant="ghost"
              leading={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => void navigate('/trips/new')}
            >
              {t('home.newTrip')}
            </Button>
          </div>
          {/* 맨 위에 보인 여행은 뺀다 (여행 중이면 그 오늘 일정 묶음도 위로 옮겼다, docs/29 §7.1).
              같은 날 여행 중인 다른 여행은 지금처럼 목록 '여행 중'에 오늘 일정 묶음으로 (사용자 요청 2026-11-06) */}
          <TripList
            only="active"
            exclude={featured.id}
            renderOngoing={(tr) => <OngoingTrip trip={tr} />}
          />
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
  const ongoing = getTripStatus(trip.startDate, trip.endDate, todayIn(trip.timezone)) === 'ongoing';
  return (
    <Link
      to={`/trips/${trip.id}/plan`}
      className={cn(
        'flex flex-col gap-3 rounded-card p-5 text-white shadow-card',
        ongoing && 'bg-mint',
      )}
      // 여행 중이면 민트(아래 파란 다음 일정 카드와 구분, 사용자 요청 2026-11-06), 아니면 여행 표지 색
      style={ongoing ? undefined : { background: trip.cover.color ?? '#2F6BFF' }}
    >
      <span className="tabular self-start rounded-full bg-white/20 px-2.5 py-0.5 text-caption font-semibold">
        {formatTripBadge(trip.startDate, trip.endDate, todayIn(trip.timezone))}
      </span>
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="text-[40px] leading-none">
          {trip.cover.emoji ?? '🧳'}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 text-title-1">{trip.title}</span>
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

/**
 * 여행 중 대표 여행 한 줄 띠 (docs/29 §7.1, 사용자 결정 Q2): 이모지 · 제목 · N일차 + 노선 막대(Q7).
 * 여행 중 민트(2026-11-06 요청)는 이모지 칸과 배지에 남기고, 카드는 조용하게 — 아래 파란 다음 일정이 주인공
 */
function OngoingStrip({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const items = useTripItems(trip.id) ?? [];
  const bookings = useTripBookings(trip.id) ?? [];
  const packing = useChecklist(trip.id, 'packing') ?? [];
  const packed = packing.filter((p) => p.checked).length;
  const today = todayIn(trip.timezone);
  const total = dayNumberOf(trip.startDate, trip.endDate, trip.endDate) ?? 1;
  const day = dayNumberOf(trip.startDate, trip.endDate, today) ?? 1;
  const badge = formatTripBadge(trip.startDate, trip.endDate, today);
  return (
    <Link
      to={`/trips/${trip.id}/plan`}
      className="flex flex-col gap-2 rounded-card border border-line bg-surface px-4 py-3 shadow-card active:bg-bg-subtle"
    >
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
    </Link>
  );
}

/**
 * 출발 전 다음 이동 (docs/29 §7.1, 사용자 결정 2026-11-10 "넣기"): 오늘 이후 첫 항공·기차 예약.
 * 예약 탭과 똑같은 카드 (사용자 요청 2026-11-10) — 누르면 예약 탭의 그 예약으로 (?focus=)
 */
function NextTransport({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  const bookings = useTripBookings(trip.id) ?? [];
  const today = todayIn(trip.timezone);
  const b = bookings
    .filter((x) => (x.kind === 'flight' || x.kind === 'train') && x.start.date >= today)
    .sort((x, y) =>
      `${x.start.date} ${x.start.time ?? ''}`.localeCompare(
        `${y.start.date} ${y.start.time ?? ''}`,
      ),
    )[0];
  if (!b) return null;
  return (
    <ul className="flex flex-col">
      <Suspense fallback={null}>
        <BookingCard
          booking={b}
          onOpen={() => void navigate(`/trips/${trip.id}/bookings?focus=${b.id}`)}
        />
      </Suspense>
    </ul>
  );
}
function OngoingTrip({ trip }: { trip: Trip }) {
  const { time } = useTimeText();
  const { t } = useTranslation();
  useMinuteTick();
  // Plan B: 오늘 일정도 지금 보이는 플랜 기준 (실험실을 끄면 기본 일정만)
  const items = useTripPlanItems(trip, useTripItems(trip.id) ?? []);
  const bookings = useTripBookings(trip.id) ?? [];
  const [dirOpen, setDirOpen] = useRouteSheet('directions');
  const [dest, setDest] = useState<Destination | null>(null);

  const today = todayIn(trip.timezone);
  const day = dayNumberOf(trip.startDate, trip.endDate, today) ?? 1;
  const todayItems = (items ?? []).filter((i) => i.date === today);
  const now = nowTimeIn(trip.timezone);
  const next = nextItem(todayItems, now);
  // 지난 일정 (방문·미방문을 고를 수 있는 것) — 일정 탭과 같은 규칙
  const past = pastItemIds(todayItems, today, now);
  // 실험실: 다음 역 카드를 그날 노선 색으로 (2026-11-10)
  const dayColorOn = useLab('nextStopDayColor');
  // 지난 일정 접기 (사용자 결정 2026-11-10) — 다음 일정·남은 일정이 바로 보이게
  const [pastOpen, setPastOpen] = useState(false);
  const pastList = todayItems.filter((i) => past.has(i.id));
  const shown = pastOpen ? todayItems : todayItems.filter((i) => !past.has(i.id));
  // 진행 막대의 출발점: 다음 일정 바로 앞, 시각이 있는 일정
  const nextIdx = next ? todayItems.findIndex((i) => i.id === next.id) : -1;
  const prevStop =
    nextIdx > 0
      ? ([...todayItems.slice(0, nextIdx)].reverse().find((i) => i.startTime) ?? null)
      : null;
  async function markVisit(item: ItineraryItem, v: Visit | null) {
    const r = await applyVisit(item, v, trip);
    if (r === 'saved') toast(t('visit.savedToSaved'));
    else if (r === 'limit') toast(t('saved.limit', { max: SAVED_PLACES_MAX }));
  }
  // 오늘 다 끝나면 내일 첫 일정
  const tomorrow = addDays(today, 1);
  const tomorrowFirst =
    !next && tomorrow <= trip.endDate
      ? ((items ?? []).find((i) => i.date === tomorrow && !i.done) ?? null)
      : null;
  const lodging = lodgingForNight(bookings, today);
  const planUrl = `/trips/${trip.id}/plan?day=${day}`;

  function directions(d: Destination) {
    if (openDirectionsDirect(d, isDomesticTrip(trip))) return;
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
      {/* 여행 이름·배지는 맨 위 여행 카드에 있어 여기서는 뺀다 (2026-11-06) */}
      <Suspense fallback={null}>
        <TripAlertBanner trip={trip} />
      </Suspense>
      {/* 무료 취소 마감 (실험실) */}
      <Suspense fallback={null}>
        <HomeLabs trip={trip} bookings={bookings} ongoing />
      </Suspense>

      {next ? (
        // 다음 일정 카드 (docs/29 §4.4, 사용자 결정 Q3 파랑 채움): 남은 시간 크게 + 지난 일정 → 다음 일정 진행 막대
        <NextStopCard
          tone={dayColorOn ? routeColor(day - 1).ink : undefined}
          label={t('home.nextItem')}
          kicker={t('home.nextItem')}
          title={next.title}
          // 남은 시간만 (뒤 시각·주소는 뺐다 — "분"이 다음 줄로 밀려서, 사용자 요청 2026-11-10)
          countdown={countdown(next)}
          progress={prevStop && next.startTime ? progressBetween(prevStop, next, now) : null}
          progressLabel={prevStop ? `${prevStop.title} → ${next.title}` : undefined}
          from={prevStop?.title}
          to={next.title}
          actions={
            <>
              <button
                type="button"
                onClick={() =>
                  directions({
                    name: next.title,
                    address: next.place?.address,
                    coords: next.place?.coords,
                  })
                }
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-btn bg-on-primary px-3 text-body-2 font-medium text-primary"
              >
                <Navigation aria-hidden="true" className="size-4" />
                {t('home.directions')}
              </button>
              <Link
                to={planUrl}
                className="flex h-11 flex-1 items-center justify-center rounded-btn bg-on-primary/20 px-3 text-body-2 font-medium text-on-primary"
              >
                {t('home.viewPlan')}
              </Link>
            </>
          }
        />
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
          className="flex flex-col rounded-card border border-line bg-surface px-4 py-2"
        >
          <div className="flex min-h-11 items-center justify-between gap-2">
            <h2 className="text-body-2 font-semibold">
              {t('home.todayItems', { n: todayItems.length })}
            </h2>
            {/* 지난 일정은 접어 둔다 — 여행 모드와 같은 문구 (사용자 결정 2026-11-10) */}
            {pastList.length > 0 && (
              <button
                type="button"
                aria-expanded={pastOpen}
                onClick={() => setPastOpen(!pastOpen)}
                className="flex h-9 items-center gap-1 text-caption font-semibold text-fg-sub"
              >
                {t('travel.pastN', { n: pastList.length })}
                <ChevronDown
                  aria-hidden="true"
                  className={cn('size-4 transition-transform', pastOpen && 'rotate-180')}
                />
              </button>
            )}
          </div>
          {/* 오늘 노선 (docs/29 §7.1): 지난 일정은 흐리게 + 오른쪽 [미방문][방문] — 일정 탭·여행 모드와 같은 기록 (2026-11-06) */}
          <RouteLine label={t('home.todayItems', { n: todayItems.length })} dayIndex={day - 1}>
            {shown.map((item, i) => (
              <RouteStop
                key={item.id}
                number={item.kind === 'note' ? undefined : todayItems.indexOf(item) + 1}
                state={item.id === next?.id ? 'next' : past.has(item.id) ? 'past' : 'default'}
                mark={item.visit ?? null}
                title={item.title}
                time={time(item.startTime) ?? undefined}
                last={i === shown.length - 1}
                dense
                trailing={
                  item.kind !== 'note' && past.has(item.id) ? (
                    <VisitToggle
                      value={item.visit}
                      label={item.title}
                      onChange={(v) => void markVisit(item, v)}
                    />
                  ) : undefined
                }
              />
            ))}
          </RouteLine>
        </section>
      )}

      {lodging && (
        <section
          aria-label={t('home.lodgingTonight')}
          className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
        >
          <p className="flex items-center gap-2 text-caption font-semibold text-fg-muted">
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
