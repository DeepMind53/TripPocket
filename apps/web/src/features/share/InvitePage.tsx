import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, Link } from 'react-router';
import { shareApi } from '../../data/api/share';
import { refreshMe, useAuth } from '../../data/authStore';
import { db } from '../../data/db';
import { useTranslation } from '../../i18n';
import { EmptyState, Spinner } from '../../shared/ui';

/**
 * S-41 초대 수락: 로그인 → 수락 → 여행을 처음부터 다시 받아 그 여행으로.
 * (이미 받은 rev보다 앞선 여행 기록도 받아야 하므로 마지막 rev를 0으로)
 */
export function InvitePage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const status = useAuth((s) => s.status);
  const [failed, setFailed] = useState(false);
  // 소유자의 허용을 기다리는 중 (링크만으로는 권한이 생기지 않음)
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === 'unknown') void refreshMe();
    if (status !== 'user') return;
    let alive = true;
    void shareApi.accept(token).then(async (r) => {
      if (!alive) return;
      if (!r.ok) return setFailed(true);
      if (r.data.status === 'pending') return setPending(true);
      await db.syncState.delete('lastRev');
      const { syncNow } = await import('../../data/sync/syncEngine');
      await syncNow();
      void navigate(`/trips/${r.data.tripId}/plan`, { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [status, token, navigate]);

  if (status === 'anon' || status === 'offline')
    return <Navigate to={`/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`} replace />;
  if (pending)
    return (
      <EmptyState
        asPageTitle
        emoji="📨"
        title={t('share.requestSent')}
        description={t('share.requestSentDesc')}
        action={
          <Link
            to="/"
            replace
            className="inline-flex h-11 items-center rounded-btn bg-primary px-4 font-semibold text-on-primary"
          >
            {t('common.goHome')}
          </Link>
        }
      />
    );
  if (failed)
    return (
      <EmptyState
        emoji="✉️"
        title={t('share.inviteInvalid')}
        description={t('share.inviteInvalidDesc')}
      />
    );
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner />
    </div>
  );
}
