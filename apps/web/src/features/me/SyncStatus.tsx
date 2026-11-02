import { useAuth } from '../../data/authStore';
import { useSync } from '../../data/sync/syncStore';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

/** 마이 제목 줄의 동기화 상태: "동기화됨" / "올릴 변경 3개" / "서버에 연결할 수 없어요" */
export function SyncStatus() {
  const { t } = useTranslation();
  const loggedIn = useAuth((s) => s.status === 'user');
  const { state, pending } = useSync();
  if (!loggedIn) return null;
  const text =
    state === 'syncing'
      ? t('sync.syncing')
      : state === 'offline'
        ? t('sync.offline')
        : state === 'error'
          ? t('sync.error')
          : pending > 0
            ? t('sync.pending', { n: pending })
            : t('sync.done');
  return (
    <span
      role="status"
      className="flex max-w-[15rem] flex-wrap items-center justify-end gap-1 text-caption text-fg-sub"
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 shrink-0 rounded-full',
          state === 'idle' && pending === 0
            ? 'bg-success'
            : state === 'syncing'
              ? 'bg-primary'
              : 'bg-warning',
        )}
      />
      {text}
      {(state === 'offline' || state === 'error') && (
        <button
          type="button"
          onClick={() => void import('../../data/sync/syncEngine').then((m) => m.syncNow())}
          className="ml-1 font-semibold text-primary"
        >
          {t('sync.retry')}
        </button>
      )}
    </span>
  );
}
