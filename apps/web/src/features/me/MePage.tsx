import {
  ArchiveRestore,
  CalendarCheck,
  ChevronRight,
  CircleHelp,
  Database,
  DatabaseBackup,
  Palette,
  Settings,
  Scale,
  ShieldCheck,
  FileText,
  Smartphone,
  Sparkles,
  Users,
  Gauge,
  FlaskConical,
  SquarePen,
  Inbox,
  MessageSquarePlus,
} from 'lucide-react';
import { useAuth } from '../../data/authStore';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { AccountCard } from './AccountCard';
import { InstallSheet } from './InstallSheet';
import { MonthlyUpdateSheet } from './MonthlyUpdateSheet';
import { todayIn } from '@trippocket/shared';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { Link } from 'react-router';
import { TopBar, toast } from '../../shared/ui';

/** S-05 마이 — 계정(로그인), 설정, 백업, 앱 설치 */
export function MePage() {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => s.status === 'user' && s.me?.isAdmin === true);
  const [installOpen, setInstallOpen] = useRouteSheet('install');
  const [monthlyOpen, setMonthlyOpen] = useRouteSheet('monthly-update');
  return (
    <>
      <TopBar title={t('me.title')} />
      <div className="flex flex-col gap-4 px-5 pt-2">
        <AccountCard />
        {/* 묶음: 여행 도구 · 관리자(관리자만) · 앱 정보 (docs/16 H1) */}
        <MenuGroup title={t('me.groupTools')}>
          <MenuRow to="/settings" icon={<Settings />} label={t('me.settings')} />
          <MenuRow to="/backup" icon={<DatabaseBackup />} label={t('me.backup')} />
          {/* 설치한 뒤에도 늘 보인다 (다른 기기에 추가·아이콘을 지운 경우, 사용자 요청 2026-10-24) */}
          <MenuRow
            icon={<Smartphone />}
            label={t('pwa.installTitle')}
            onClick={() => setInstallOpen(true)}
          />
          <MenuRow to="/me/reviews" icon={<SquarePen />} label={t('review.myTitle')} />
          <MenuRow to="/me/trash" icon={<ArchiveRestore />} label={t('trash.title')} />
          <MenuRow to="/labs" icon={<FlaskConical />} label={t('me.labs')} />
        </MenuGroup>
        {isAdmin && (
          <MenuGroup title={t('me.groupAdmin')}>
            <MenuRow to="/admin/users" icon={<Users />} label={t('admin.title')} />
            <MenuRow to="/admin/api-usage" icon={<Gauge />} label={t('apiUsage.title')} />
            <MenuRow to="/admin/ai" icon={<Sparkles />} label={t('me.devAi')} />
            <MenuRow to="/admin/suggestions" icon={<Inbox />} label={t('suggest.adminTitle')} />
            <MenuRow
              icon={<CalendarCheck />}
              label={t('monthly.title')}
              onClick={() => setMonthlyOpen(true)}
            />
          </MenuGroup>
        )}
        <MenuGroup title={t('me.groupInfo')}>
          <MenuRow to="/me/suggestions" icon={<MessageSquarePlus />} label={t('suggest.title')} />
          <MenuRow to="/help" icon={<CircleHelp />} label={t('me.help')} />
          <MenuRow to="/legal/privacy" icon={<ShieldCheck />} label={t('legal.privacy')} />
          <MenuRow to="/legal/terms" icon={<FileText />} label={t('legal.terms')} />
          <MenuRow to="/legal/licenses" icon={<Scale />} label={t('legal.licenses')} />
          {import.meta.env.DEV && (
            <>
              <MenuRow to="/dev/ui" icon={<Palette />} label={t('me.devUi')} />
              <MenuRow to="/dev/db" icon={<Database />} label={t('me.devDb')} />
            </>
          )}
        </MenuGroup>
        {/* 마지막 업데이트 = git에 올린 시각 (vite.config.ts buildVersion) */}
        <p className="tabular pt-2 pb-4 text-center text-caption text-fg-muted">
          {t('me.version', { v: import.meta.env.VITE_APP_VERSION as string })}
        </p>
      </div>
      <InstallSheet open={installOpen} onOpenChange={setInstallOpen} />
      {isAdmin && monthlyOpen && (
        <MonthlyUpdateSheet
          open={monthlyOpen}
          onOpenChange={setMonthlyOpen}
          month={todayIn('Asia/Seoul').slice(0, 7)}
        />
      )}
    </>
  );
}

function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <h2 className="px-1 text-caption font-bold text-fg-muted">{title}</h2>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
        {children}
      </ul>
    </section>
  );
}

interface MenuRowProps {
  to?: string;
  icon: ReactNode;
  label: string;
  step?: number;
  onClick?: () => void;
}

function MenuRow({ to, icon, label, step, onClick }: MenuRowProps) {
  const { t } = useTranslation();
  const inner = (
    <>
      <span aria-hidden="true" className="text-fg-sub [&>svg]:size-5">
        {icon}
      </span>
      <span className="flex-1 text-body-2 font-medium">{label}</span>
      <ChevronRight aria-hidden="true" className="size-5 text-fg-muted" />
    </>
  );
  const cls = 'flex min-h-14 w-full items-center gap-3 bg-surface px-4 text-left';
  return (
    <li>
      {to ? (
        <Link to={to} className={cls}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          className={cls}
          onClick={onClick ?? (() => toast(t('common.comingInStep', { step: step ?? 0 })))}
        >
          {inner}
        </button>
      )}
    </li>
  );
}
