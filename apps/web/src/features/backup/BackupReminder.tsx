import { DatabaseBackup, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { settingsRepo } from '../../data/repositories/settingsRepo';
import { lastBackupAt } from '../../data/repositories/backupMeta';
import { useSettings } from '../../data/settingsStore';
import { useTranslation } from '../../i18n';

const DISMISS_KEY = 'backupReminderDismissedAt';
const DAY = 86_400_000;

/**
 * 홈 백업 알림 (docs/06 §3.4): 여행이 있고, 마지막 백업이 설정한 주기보다 오래됐으면.
 * 닫으면 7일간 숨김. 설정에서 "끄기"면 안 보임
 */
export function BackupReminder({ firstDataAt }: { firstDataAt: string | null }) {
  const hasData = firstDataAt !== null;
  const { t } = useTranslation();
  const every = useSettings((s) => s.backupReminderDays);
  const [state, setState] = useState<{ days: number | null } | null>(null);

  useEffect(() => {
    if (!hasData || every === 0) return;
    let alive = true;
    void Promise.all([lastBackupAt(), settingsRepo.get<string | null>(DISMISS_KEY, null)]).then(
      ([last, dismissed]) => {
        if (!alive) return;
        if (dismissed && Date.now() - Date.parse(dismissed) < 7 * DAY) return;
        const since = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / DAY);
        // 한 번도 안 했으면 첫 여행을 만든 지 주기만큼 지났을 때부터
        if (last ? since(last) >= every : since(firstDataAt ?? '') >= every)
          setState({ days: last ? since(last) : null });
      },
    );
    return () => {
      alive = false;
    };
  }, [hasData, every, firstDataAt]);

  if (!state || !hasData || every === 0) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-card border border-line bg-surface py-2 pr-1 pl-3"
    >
      <DatabaseBackup aria-hidden="true" className="size-5 shrink-0 text-warning" />
      <p className="min-w-0 flex-1 text-caption text-fg-sub">
        {state.days === null ? t('backup.reminderNever') : t('backup.reminder', { n: state.days })}
      </p>
      <Link to="/backup" className="shrink-0 px-2 text-caption font-bold text-primary">
        {t('backup.reminderCta')}
      </Link>
      <button
        type="button"
        aria-label={t('backup.dismiss')}
        onClick={() => {
          setState(null);
          void settingsRepo.set(DISMISS_KEY, new Date().toISOString());
        }}
        className="grid size-9 shrink-0 place-items-center text-fg-muted"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
