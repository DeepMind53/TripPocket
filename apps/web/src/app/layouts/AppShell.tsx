import { Heart, House, Luggage, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { useBottomInset } from '../../shared/hooks/useBottomInset';
import { TabBar } from '../../shared/ui';

export const TAB_BAR_HEIGHT = 56;

/** 앱 하단 탭 4개 (docs/11 §6): 홈 · 내 여행 · 저장 · 마이 */
export function AppShell() {
  const { t } = useTranslation();
  useBottomInset(TAB_BAR_HEIGHT);
  return (
    <div className="mx-auto min-h-dvh max-w-[560px]">
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+16px)]">
        <Outlet />
      </main>
      <TabBar
        label={t('nav.label')}
        items={[
          { to: '/', label: t('nav.home'), icon: House, end: true },
          { to: '/trips', label: t('nav.trips'), icon: Luggage },
          { to: '/saved', label: t('nav.saved'), icon: Heart },
          { to: '/me', label: t('nav.me'), icon: UserRound },
        ]}
      />
    </div>
  );
}
