import { todayIn } from '@trippocket/shared';
import {
  CalendarDays,
  Ellipsis,
  ListChecks,
  Search,
  Settings,
  Share2,
  Ticket,
  Trash2,
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useTranslation } from '../../i18n';
import { Link, Outlet, useNavigate, useParams } from 'react-router';
import { useTrip } from '../../data/hooks';
import { QuickMenuButton } from '../../features/common/QuickMenu';
import { deleteTripWithUndo } from '../../features/trips/tripActions';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { useBottomInset } from '../../shared/hooks/useBottomInset';
import { formatPeriod, formatTripBadge } from '../../shared/lib/dateFormat';
import { BottomSheet, Button, EmptyState, IconButton, TabBar, TopBar } from '../../shared/ui';
import { TAB_BAR_HEIGHT } from './AppShell';
import { useLab } from '../../data/labsStore';
import { useWakeLock } from '../../shared/hooks/useWakeLock';
import { localTimeLabel, useMinuteClock } from '../../shared/hooks/useMinuteClock';

// 공유는 누를 때만 불러온다
const ShareSheet = lazy(async () => ({
  default: (await import('../../features/share/ShareSheet')).ShareSheet,
}));

/**
 * 여행 상세: 앱 탭 대신 여행 전용 탭 4개 (docs/11 §6)
 * 헤더: ← · 여행 제목 · 동기화 상태 · ⚡ · ⋯
 */
export function TripLayout() {
  const { t } = useTranslation();
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen, switchMenuTo] = useRouteSheet('trip-menu');
  const [shareOpen, setShareOpen] = useRouteSheet('trip-share');
  useBottomInset(trip ? TAB_BAR_HEIGHT : 0);
  useWakeLock(useLab('wakeLock'));
  const clockOn = useLab('localClock');
  const now = useMinuteClock(clockOn);

  if (trip === null) {
    return (
      <div className="mx-auto min-h-dvh max-w-[560px]">
        <TopBar title={t('trips.notFound')} backTo="/trips" />
        <EmptyState
          emoji="🧭"
          title={t('trips.notFound')}
          description={t('trips.notFoundDesc')}
          action={
            <Link
              to="/trips"
              replace
              className="inline-flex h-11 items-center rounded-btn bg-primary px-4 font-semibold text-on-primary"
            >
              {t('trips.backToList')}
            </Link>
          }
        />
      </div>
    );
  }

  const base = `/trips/${encodeURIComponent(tripId)}`;
  const localClock = clockOn && trip ? localTimeLabel(trip.timezone, now, t) : null;

  return (
    <div className="mx-auto min-h-dvh max-w-[560px]">
      <TopBar
        title={trip ? `${trip.cover.emoji ?? ''} ${trip.title}`.trim() : ''}
        {...(trip
          ? {
              subtitle: `${formatPeriod(trip.startDate, trip.endDate)} · ${formatTripBadge(trip.startDate, trip.endDate, todayIn(trip.timezone))}${localClock ? ` · ${localClock}` : ''}`,
            }
          : {})}
        backTo="/trips"
        actions={
          <>
            {/* 동기화 상태 아이콘은 15단계(동기화)에서 추가 — 그전엔 제목 자리를 넓히려고 비워 둔다 */}
            <QuickMenuButton inTrip />
            <IconButton
              label={t('header.more')}
              icon={<Ellipsis />}
              onClick={() => setMenuOpen(true)}
            />
          </>
        }
      />
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)]">{trip && <Outlet />}</main>
      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title={trip?.title ?? ''}>
        {trip && (
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              fullWidth
              className="justify-start"
              leading={<Share2 aria-hidden="true" className="size-[18px]" />}
              onClick={() => switchMenuTo('trip-share')}
            >
              {t('share.title')}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              className="justify-start"
              leading={<Settings aria-hidden="true" className="size-[18px]" />}
              // 메뉴 시트 기록을 설정 화면으로 바꿔서, 설정에서 뒤로 가면 여행 화면
              onClick={() => void navigate(`${base}/settings`, { replace: true })}
            >
              {t('trips.settings')}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              className="justify-start text-danger"
              leading={<Trash2 aria-hidden="true" className="size-[18px]" />}
              onClick={() => {
                void deleteTripWithUndo(trip);
                void navigate('/trips', { replace: true });
              }}
            >
              {t('trips.delete')}
            </Button>
          </div>
        )}
      </BottomSheet>
      {trip && shareOpen && (
        <Suspense fallback={null}>
          <ShareSheet trip={trip} open={shareOpen} onOpenChange={setShareOpen} />
        </Suspense>
      )}
      <TabBar
        label={t('tripNav.label')}
        items={[
          { to: `${base}/plan`, label: t('tripNav.plan'), icon: CalendarDays },
          { to: `${base}/places`, label: t('tripNav.places'), icon: Search },
          { to: `${base}/bookings`, label: t('tripNav.bookings'), icon: Ticket },
          { to: `${base}/checklist`, label: t('tripNav.checklist'), icon: ListChecks },
        ]}
      />
    </div>
  );
}
