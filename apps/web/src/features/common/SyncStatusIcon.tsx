import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../../data/authStore';
import { useSync } from '../../data/sync/syncStore';
import { useTranslation } from '../../i18n';
import { toast } from '../../shared/ui';

/**
 * 여행 헤더의 작은 동기화 상태 (docs/16 F1, docs/11 §2-6 "겁주지 않기"):
 * ✓ 저장됨 / ↻ 올리는 중(또는 올릴 것 있음) / ☁̸ 오프라인 — 기기에는 저장됨. 누르면 한 줄 설명
 */
export function SyncStatusIcon() {
  const { t } = useTranslation();
  const loggedIn = useAuth((s) => s.status === 'user' || s.status === 'offline');
  const state = useSync((s) => s.state);
  const pending = useSync((s) => s.pending);
  if (!loggedIn) return null;
  const kind =
    state === 'offline' || state === 'error'
      ? 'offline'
      : state === 'syncing' || pending > 0
        ? 'syncing'
        : 'saved';
  const label = t(`sync.icon.${kind}`);
  const Icon = kind === 'offline' ? CloudOff : kind === 'syncing' ? RefreshCw : Check;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => toast(t(`sync.icon.${kind}Desc`))}
      className="grid size-9 shrink-0 place-items-center rounded-full text-fg-muted"
    >
      <Icon
        aria-hidden="true"
        className={
          kind === 'syncing'
            ? 'size-4 animate-spin text-primary motion-reduce:animate-none'
            : kind === 'offline'
              ? 'size-4 text-warning'
              : 'size-4 text-success'
        }
      />
    </button>
  );
}
