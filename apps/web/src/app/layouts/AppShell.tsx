import { Heart, House, BookOpen, UserRound } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { Outlet } from 'react-router';
import { useBottomInset } from '../../shared/hooks/useBottomInset';
import { TabBar } from '../../shared/ui';
import { QuickMenuButton } from '../../features/common/QuickMenu';

export const TAB_BAR_HEIGHT = 56;

/** 앱 하단 탭 4개 (docs/11 §6, 2026-10-24 변경): 홈(여행 목록) · 기록 · 저장 · 마이 + ⚡ 플로팅 빠른 메뉴 */
export function AppShell() {
  const { t } = useTranslation();
  useBottomInset(TAB_BAR_HEIGHT);
  return (
    <div className="mx-auto min-h-dvh max-w-[560px]">
      <main className="pb-[calc(56px+env(safe-area-inset-bottom)+80px)]">
        <Outlet />
      </main>
      <QuickMenuButton />
      <TabBar
        label={t('nav.label')}
        items={[
          { to: '/', label: t('nav.home'), icon: House, end: true },
          { to: '/records', label: t('nav.records'), icon: BookOpen },
          { to: '/saved', label: t('nav.saved'), icon: Heart },
          { to: '/me', label: t('nav.me'), icon: UserRound },
        ]}
      />
    </div>
  );
}
