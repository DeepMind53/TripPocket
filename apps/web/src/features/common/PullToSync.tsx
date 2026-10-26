import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSync } from '../../data/sync/syncStore';
import { useTranslation } from '../../i18n';
import { toast } from '../../shared/ui';

/** 이만큼 당기면 놓을 때 동기화 */
const PULL_PX = 70;

/**
 * 당겨서 동기화 (2026-10-26 정식): 화면 맨 위에서 아래로 당겼다 놓으면 지금 동기화 (docs/16 I3).
 * 시트가 열려 있거나 스크롤이 맨 위가 아니면 아무 일도 안 한다
 */
export function PullToSync() {
  const { t } = useTranslation();
  const [pull, setPull] = useState(0);

  useEffect(() => {
    let y0: number | null = null;
    let dist = 0;
    const start = (e: TouchEvent) => {
      dist = 0;
      y0 =
        window.scrollY <= 0 && e.touches.length === 1 && !document.querySelector('[role="dialog"]')
          ? e.touches[0]!.clientY
          : null;
    };
    const move = (e: TouchEvent) => {
      if (y0 === null) return;
      dist = Math.max(0, e.touches[0]!.clientY - y0);
      setPull(Math.min(dist, PULL_PX * 1.4));
    };
    const end = () => {
      if (y0 !== null && dist >= PULL_PX)
        void import('../../data/sync/syncEngine').then(async (m) => {
          await m.syncNow();
          const s = useSync.getState().state;
          toast(
            t(
              s === 'idle'
                ? 'labs.synced'
                : s === 'offline'
                  ? 'labs.syncOffline'
                  : 'labs.syncFailed',
            ),
          );
        });
      y0 = null;
      setPull(0);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [t]);

  if (pull < 8) return null;
  const ready = pull >= PULL_PX;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
      style={{ top: `calc(var(--safe-top) + ${Math.min(pull, PULL_PX) - 8}px)` }}
    >
      <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-caption text-fg-sub shadow-card">
        <RefreshCw
          aria-hidden="true"
          className="size-4"
          style={{ transform: `rotate(${pull * 4}deg)` }}
        />
        {t(ready ? 'labs.pullRelease' : 'labs.pullMore')}
      </span>
    </div>
  );
}
