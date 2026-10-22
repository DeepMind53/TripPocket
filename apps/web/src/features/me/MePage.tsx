import { ChevronRight, CircleHelp, DatabaseBackup, Palette, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { QuickMenuButton } from '../quick-menu/QuickMenu';
import { Button, TopBar, toast } from '../../shared/ui';

/** S-05 마이 — 로그인은 14단계, 백업은 11단계 */
export function MePage() {
  const { t } = useTranslation();
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
          <MenuRow icon={<DatabaseBackup />} label={t('me.backup')} step={11} />
          <MenuRow icon={<CircleHelp />} label={t('me.help')} step={23} />
          {import.meta.env.DEV && <MenuRow to="/dev/ui" icon={<Palette />} label={t('me.devUi')} />}
        </ul>
      </div>
    </>
  );
}

interface MenuRowProps {
  to?: string;
  icon: ReactNode;
  label: string;
  step?: number;
}

function MenuRow({ to, icon, label, step }: MenuRowProps) {
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
          onClick={() => toast(t('common.comingInStep', { step: step ?? 0 }))}
        >
          {inner}
        </button>
      )}
    </li>
  );
}
