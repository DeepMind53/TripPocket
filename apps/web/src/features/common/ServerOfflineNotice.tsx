import { useState } from 'react';
import { refreshMe, useAuth } from '../../data/authStore';
import { useTranslation } from '../../i18n';
import { Button, EmptyState, Spinner } from '../../shared/ui';
import { OfflineNote } from './OfflineNote';

/**
 * 서버가 필요한 기능(장소 찾기·AI·공유 링크·계정)이 지금 서버에 닿지 않을 때 (docs/16 A2).
 * 앱은 로그인한 사람만 쓰므로(AuthGate) 여기서 로그인 버튼은 보이지 않는다 — 로그인했던 기기가
 * 오프라인이거나 홈 PC가 꺼진 경우. 확인 중(unknown)이면 잠깐 돌아가는 표시만
 */
export function ServerOfflineNotice({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation();
  const status = useAuth((s) => s.status);
  const [busy, setBusy] = useState(false);
  if (status === 'unknown')
    return inline ? null : (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  const retry = async () => {
    setBusy(true);
    await refreshMe();
    setBusy(false);
  };
  if (inline) return <OfflineNote text={t('offline.inline')} />;
  return (
    <EmptyState
      emoji="🔌"
      title={t('offline.title')}
      description={t('offline.desc')}
      action={
        <Button variant="secondary" loading={busy} onClick={() => void retry()}>
          {t('offline.retry')}
        </Button>
      }
    />
  );
}
