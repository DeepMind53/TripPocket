import { CalendarDays, CloudOff, Ellipsis, ListChecks, Search, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet, useParams } from 'react-router';
import { QuickMenuButton } from '../../features/quick-menu/QuickMenu';
import { useBottomInset } from '../../shared/hooks/useBottomInset';
import { IconButton, TabBar, TopBar, toast } from '../../shared/ui';
import { TAB_BAR_HEIGHT } from './AppShell';

/**
 * 여행 상세: 앱 탭 대신 여행 전용 탭 4개 (docs/11 §6)
 * 헤더: ← · 여행 제목 · 동기화 상태 · ⚡ · ⋯
 */
export function TripLayout() {
  const { t } = useTranslation();
  const { tripId = '' } = useParams();
  useBottomInset(TAB_BAR_HEIGHT);

  // 4~5단계에서 저장소의 여행 정보로 바뀐다
  const title = tripId === 'demo' ? `🗼 ${t('trips.demoTitle')}` : t('trips.title');
  const base = `/trips/${encodeURIComponent(tripId)}`;

  return (
    <div className="mx-auto min-h-dvh max-w-[560px]">
      <TopBar
        title={title}
        {...(tripId === 'demo' ? { subtitle: '10.24 (금) – 10.28 (화) · 4박 5일' } : {})}
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
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)]">
        <Outlet />
      </main>
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
