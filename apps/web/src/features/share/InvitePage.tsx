import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
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

  useEffect(() => {
    if (status === 'unknown') void refreshMe();
    if (status !== 'user') return;
    let alive = true;
    void shareApi.accept(token).then(async (r) => {
      if (!alive) return;
      if (!r.ok) return setFailed(true);
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
