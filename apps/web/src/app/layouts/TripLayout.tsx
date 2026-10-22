import { todayIn } from '@trippocket/shared';
import { CalendarDays, CloudOff, Ellipsis, ListChecks, Search, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useParams } from 'react-router';
import { useTrip } from '../../data/hooks';
import { QuickMenuButton } from '../../features/quick-menu/QuickMenu';
import { useBottomInset } from '../../shared/hooks/useBottomInset';
import { formatPeriod, formatTripBadge } from '../../shared/lib/dateFormat';
import { EmptyState, IconButton, TabBar, TopBar, toast } from '../../shared/ui';
import { TAB_BAR_HEIGHT } from './AppShell';

/**
 * 여행 상세: 앱 탭 대신 여행 전용 탭 4개 (docs/11 §6)
 * 헤더: ← · 여행 제목 · 동기화 상태 · ⚡ · ⋯
 */
export function TripLayout() {
  const { t } = useTranslation();
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  useBottomInset(trip ? TAB_BAR_HEIGHT : 0);

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

  return (
    <div className="mx-auto min-h-dvh max-w-[560px]">
      <TopBar
        title={trip ? `${trip.cover.emoji ?? ''} ${trip.title}`.trim() : ''}
        {...(trip
          ? {
              subtitle: `${formatPeriod(trip.startDate, trip.endDate)} · ${formatTripBadge(trip.startDate, trip.endDate, todayIn(trip.timezone))}`,
            }
          : {})}
        backTo="/trips"
        actions={
          <>
            {/* 15단계(동기화)까지는 항상 "이 기기에만 저장" 상태 */}
            <IconButton
              label={t('header.syncLocal')}
              icon={<CloudOff />}
              onClick={() => toast(t('header.syncLocal'))}
            />
            <QuickMenuButton inTrip />
            <IconButton
              label={t('header.more')}
              icon={<Ellipsis />}
              onClick={() => toast(t('common.comingInStep', { step: 7 }))}
            />
          </>
        }
      />
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)]">{trip && <Outlet />}</main>
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
