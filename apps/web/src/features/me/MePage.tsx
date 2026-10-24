import {
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
} from 'lucide-react';
import { useAuth } from '../../data/authStore';
import { useInstall } from '../../app/pwa';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { AccountCard } from './AccountCard';
import { InstallSheet } from './InstallSheet';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { Link } from 'react-router';
import { TopBar, toast } from '../../shared/ui';

/** S-05 마이 — 계정(로그인), 설정, 백업, 앱 설치 */
export function MePage() {
  const { t } = useTranslation();
  const installed = useInstall((s) => s.installed);
  const isAdmin = useAuth((s) => s.status === 'user' && s.me?.isAdmin === true);
  const [installOpen, setInstallOpen] = useRouteSheet('install');
  return (
    <>
      <TopBar title={t('me.title')} />
      <div className="flex flex-col gap-4 px-5 pt-2">
        <AccountCard />
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
          {isAdmin && (
            <>
              <MenuRow to="/admin/users" icon={<Users />} label={t('admin.title')} />
              <MenuRow to="/admin/api-usage" icon={<Gauge />} label={t('apiUsage.title')} />
              <MenuRow to="/admin/ai" icon={<Sparkles />} label={t('me.devAi')} />
            </>
          )}
          <MenuRow to="/settings" icon={<Settings />} label={t('me.settings')} />
          <MenuRow to="/backup" icon={<DatabaseBackup />} label={t('me.backup')} />
          {!installed && (
            <MenuRow
              icon={<Smartphone />}
              label={t('pwa.installTitle')}
              onClick={() => setInstallOpen(true)}
            />
          )}
          <MenuRow to="/labs" icon={<FlaskConical />} label={t('me.labs')} />
          <MenuRow to="/legal/help" icon={<CircleHelp />} label={t('me.help')} />
        </ul>
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
          <MenuRow to="/legal/privacy" icon={<ShieldCheck />} label={t('legal.privacy')} />
          <MenuRow to="/legal/terms" icon={<FileText />} label={t('legal.terms')} />
          <MenuRow to="/legal/licenses" icon={<Scale />} label={t('legal.licenses')} />
          {import.meta.env.DEV && (
            <>
              <MenuRow to="/dev/ui" icon={<Palette />} label={t('me.devUi')} />
              <MenuRow to="/dev/db" icon={<Database />} label={t('me.devDb')} />
            </>
          )}
        </ul>
      </div>
      <InstallSheet open={installOpen} onOpenChange={setInstallOpen} />
    </>
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
