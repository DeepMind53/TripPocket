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
  Users,
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useTranslation } from '../../i18n';
import { Link, Outlet, useNavigate, useParams } from 'react-router';
import { useTrip } from '../../data/hooks';
import { useCanEdit, useMemberCount } from '../../data/tripRoles';
import { QuickMenuButton } from '../../features/common/QuickMenu';
import { SyncStatusIcon } from '../../features/common/SyncStatusIcon';
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
 * 헤더: ← · 여행 제목 · ⋯ (⚡ 빠른 메뉴는 플로팅 버튼)
 */
export function TripLayout() {
  const { t } = useTranslation();
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const canEdit = useCanEdit(tripId);
  const members = useMemberCount(tripId);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen, switchMenuTo] = useRouteSheet('trip-menu');
  const [shareOpen, setShareOpen] = useRouteSheet('trip-share');
  useBottomInset(trip ? TAB_BAR_HEIGHT : 0);
  useWakeLock(useLab('wakeLock'));
  const clockOn = useLab('localClock');
  const vt = useLab('viewTransitions');
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
        backTo="/"
        actions={
          <>
            <SyncStatusIcon />
            {/* 함께 쓰는 여행이면 멤버 수 — 누르면 공유·멤버 시트 (사용자 요청 2026-10-24) */}
            {members > 1 && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                aria-label={t('share.membersCount', { n: members })}
                className="tabular flex h-9 shrink-0 items-center gap-1 rounded-full bg-primary-weak px-2.5 text-caption font-semibold text-primary"
              >
                <Users aria-hidden="true" className="size-4" />
                {members}
              </button>
            )}
            <IconButton
              label={t('header.more')}
              icon={<Ellipsis />}
              onClick={() => setMenuOpen(true)}
            />
          </>
        }
      />
      {trip && !canEdit && (
        <p
          role="status"
          className="mx-5 mb-2 rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub"
        >
          {t('share.readOnly.banner')}
        </p>
      )}
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+96px)]">{trip && <Outlet />}</main>
      {trip && <QuickMenuButton inTrip />}
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
            {canEdit && (
              <>
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
              </>
            )}
          </div>
        )}
      </BottomSheet>
      {trip && shareOpen && (
        <Suspense fallback={null}>
          <ShareSheet trip={trip} open={shareOpen} onOpenChange={setShareOpen} />
        </Suspense>
      )}
      <TabBar
        viewTransition={vt}
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
