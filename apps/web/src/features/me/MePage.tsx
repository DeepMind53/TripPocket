import {
  ChevronRight,
  CircleHelp,
  Database,
  DatabaseBackup,
  Palette,
  Settings,
  Smartphone,
} from 'lucide-react';
import { useInstall } from '../../app/pwa';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { InstallSheet } from './InstallSheet';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { Link } from 'react-router';
import { QuickMenuButton } from '../common/QuickMenu';
import { Button, TopBar, toast } from '../../shared/ui';

/** S-05 마이 — 로그인은 14단계, 백업은 11단계 */
export function MePage() {
  const { t } = useTranslation();
  const installed = useInstall((s) => s.installed);
  const [installOpen, setInstallOpen] = useRouteSheet('install');
  return (
    <>
      <TopBar title={t('me.title')} actions={<QuickMenuButton />} />
      <div className="flex flex-col gap-4 px-5 pt-2">
        <section className="flex flex-col gap-3 rounded-card bg-bg-subtle p-4">
          <p className="text-body-2 text-fg-sub">{t('me.loginPrompt')}</p>
          <Button variant="secondary" onClick={() => toast(t('common.comingInStep', { step: 14 }))}>
            {t('me.login')}
          </Button>
        </section>
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
          <MenuRow to="/settings" icon={<Settings />} label={t('me.settings')} />
          <MenuRow to="/backup" icon={<DatabaseBackup />} label={t('me.backup')} />
          {!installed && (
            <MenuRow
              icon={<Smartphone />}
              label={t('pwa.installTitle')}
              onClick={() => setInstallOpen(true)}
            />
          )}
          <MenuRow icon={<CircleHelp />} label={t('me.help')} step={23} />
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
