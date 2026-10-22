import { useEffect, useState } from 'react';
import { useAuth } from '../../data/authStore';
import { db } from '../../data/db';
import { chooseAccountData, syncNow, useSync } from '../../data/sync/syncEngine';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button } from '../../shared/ui';

/**
 * 첫 로그인(또는 다른 계정으로 로그인) 때 이 기기에 여행이 있으면 묻는다 (docs/09 §6.3).
 * 고르기 전에는 동기화하지 않는다 — 닫으면 다음 실행 때 다시 물음
 */
export function AccountChoiceSheet() {
  const { t } = useTranslation();
  const choiceFor = useSync((s) => s.choiceFor);
  const nickname = useAuth((s) => s.me?.nickname ?? '');
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!choiceFor) return;
    void db.trips
      .filter((tr) => !tr.deletedAt)
      .count()
      .then((n) => {
        setTrips(n);
        setOpen(true);
      });
  }, [choiceFor]);

  async function choose(mode: 'upload' | 'replace') {
    if (!choiceFor) return;
    setBusy(true);
    try {
      await chooseAccountData(choiceFor, mode);
      useSync.setState({ choiceFor: null });
      setOpen(false);
      void syncNow();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title={t('syncChoice.title')}
      description={t('syncChoice.desc', { name: nickname, n: trips })}
      footer={
        <div className="flex flex-col gap-2">
          <Button size="lg" fullWidth loading={busy} onClick={() => void choose('upload')}>
            {t('syncChoice.upload', { n: trips })}
          </Button>
          <Button
            size="lg"
            fullWidth
            variant="ghost"
            disabled={busy}
            onClick={() => void choose('replace')}
          >
            {t('syncChoice.replace')}
          </Button>
        </div>
      }
    >
      <p className="text-caption text-fg-muted">{t('syncChoice.note')}</p>
    </BottomSheet>
  );
}
