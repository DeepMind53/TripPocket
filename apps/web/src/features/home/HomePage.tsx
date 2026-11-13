import { getTripStatus, daysUntil, todayIn, type Trip } from '@trippocket/shared';
import { CircleHelp, Plus, Luggage } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router';
import { useChecklist, useTripBookings, useTripItems, useTrips } from '../../data/hooks';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { formatPeriod, formatTripBadge, formatTripLength } from '../../shared/lib/dateFormat';
import { Button, EmptyState, toast } from '../../shared/ui';
import { BackupReminder } from '../backup/BackupReminder';
import { TravelModeButton } from '../travel/TravelModeButton';
import { TripList } from '../trips/TripList';
import { OngoingTrip } from './OngoingTrip';
import { TripStrip } from './TripStrip';
import { Wordmark } from './Wordmark';

// 예약 탭과 같은 카드 — 공항 정보·지연·수하물까지 딸려 와 무거워서 출발 전 다음 이동이 있을 때만 불러온다 (첫 화면 크기)
const BookingCard = lazy(async () => ({
  default: (await import('../bookings/BookingCard')).BookingCard,
}));
const PrepCards = lazy(async () => ({ default: (await import('./PrepCards')).PrepCards }));

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
        {featured && (ongoing ? <TripStrip trip={featured} /> : <UpcomingTrip trip={featured} />)}
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
