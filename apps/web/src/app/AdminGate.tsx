import { Outlet } from 'react-router';
import { useAuth } from '../data/authStore';
import { useTranslation } from '../i18n';
import { EmptyState, TopBar } from '../shared/ui';

/**
 * 관리자 화면(/admin/*)은 관리자에게만 (사용자 요청 2026-10-26).
 * 마이의 관리자 메뉴도 관리자에게만 보이고, 서버도 관리자 API마다 다시 확인한다(requireAdmin) — 여기는 주소로 바로 들어온 경우
 */
export function AdminGate() {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => s.status === 'user' && s.me?.isAdmin === true);
  if (isAdmin) return <Outlet />;
  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('me.groupAdmin')} backTo="/me" />
      <div className="px-5 pt-2">
        <EmptyState emoji="🔒" title={t('admin.onlyAdmin')} />
      </div>
    </div>
  );
}
