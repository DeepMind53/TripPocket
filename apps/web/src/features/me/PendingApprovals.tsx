import { useEffect, useState } from 'react';
import { api } from '../../data/api/client';
import { adminApi } from '../../data/api/admin';
import { shareApi } from '../../data/api/share';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BottomSheet, Button, toast } from '../../shared/ui';

interface Pending {
  joins: { id: string; nickname: string; note?: string; requestedAt: string }[];
  trips: {
    tripId: string;
    tripTitle: string;
    userId: string;
    nickname: string;
    role: 'editor' | 'viewer';
    requestedAt: string;
  }[];
}

/**
 * 허용·거절할 요청 팝업 (2026-11-25 사용자 요청): 관리자는 가입 요청, 여행 소유자는 참여 요청(초대 링크).
 * 승인 또는 거절을 고를 때까지 **앱을 열 때마다** 뜬다 — [나중에]는 이번 실행에서만 닫는다 (기기에 기억하지 않음)
 */
export function PendingApprovals() {
  const { t } = useTranslation();
  const [data, setData] = useState<Pending | null>(null);
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchPending = () => api<Pending>('/api/me/pending-approvals');
  const load = async () => {
    const r = await fetchPending();
    if (r.ok) setData(r.data);
  };
  // 앱을 열 때마다 한 번 확인 (고를 때까지 매번 뜬다)
  useEffect(() => {
    let alive = true;
    void fetchPending().then((r) => {
      if (alive && r.ok) setData(r.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const total = (data?.joins.length ?? 0) + (data?.trips.length ?? 0);
  const act = async (key: string, run: () => Promise<{ ok: boolean }>, done: string) => {
    setBusy(key);
    const r = await run();
    setBusy(null);
    toast(r.ok ? done : t('admin.failed'));
    if (r.ok) await load();
  };
  const date = (iso: string) => formatMonthDay(iso.slice(0, 10));

  return (
    <BottomSheet
      open={total > 0 && !later}
      onOpenChange={(o) => !o && setLater(true)}
      title={t('approvals.title', { n: total })}
      description={t('approvals.desc')}
    >
      <div className="flex flex-col gap-4 pb-2">
        {data && data.joins.length > 0 && (
          <section aria-label={t('approvals.joins')} className="flex flex-col gap-2">
            <h3 className="text-caption font-medium text-fg-muted">{t('approvals.joins')}</h3>
            {data.joins.map((j) => (
              <div key={j.id} className="flex flex-col gap-2 rounded-card border border-line p-3">
                <span className="flex flex-col">
                  <span className="text-body-1 font-semibold">{j.nickname}</span>
                  <span className="tabular text-caption text-fg-muted">
                    {t('approvals.requestedOn', { date: date(j.requestedAt) })}
                  </span>
                  {j.note && <span className="text-body-2 text-fg-sub">{j.note}</span>}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="dangerSoft"
                    loading={busy === `r:${j.id}`}
                    onClick={() =>
                      void act(`r:${j.id}`, () => adminApi.reject(j.id), t('admin.rejected'))
                    }
                  >
                    {t('admin.reject')}
                  </Button>
                  <Button
                    loading={busy === `a:${j.id}`}
                    onClick={() =>
                      void act(`a:${j.id}`, () => adminApi.approve(j.id), t('admin.approved'))
                    }
                  >
                    {t('admin.approve')}
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}
        {data && data.trips.length > 0 && (
          <section aria-label={t('approvals.trips')} className="flex flex-col gap-2">
            <h3 className="text-caption font-medium text-fg-muted">{t('approvals.trips')}</h3>
            {data.trips.map((r) => {
              const key = `${r.tripId}:${r.userId}`;
              return (
                <div key={key} className="flex flex-col gap-2 rounded-card border border-line p-3">
                  <span className="flex flex-col">
                    <span className="text-body-1 font-semibold">{r.nickname}</span>
                    <span className="text-caption text-fg-sub">
                      {t('approvals.tripLine', {
                        trip: r.tripTitle,
                        role: t(`share.role.${r.role}`),
                      })}
                    </span>
                    <span className="tabular text-caption text-fg-muted">
                      {t('approvals.requestedOn', { date: date(r.requestedAt) })}
                    </span>
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="dangerSoft"
                      loading={busy === `r:${key}`}
                      onClick={() =>
                        void act(
                          `r:${key}`,
                          () => shareApi.reject(r.tripId, r.userId),
                          t('admin.rejected'),
                        )
                      }
                    >
                      {t('share.reject')}
                    </Button>
                    <Button
                      loading={busy === `a:${key}`}
                      onClick={() =>
                        void act(
                          `a:${key}`,
                          () => shareApi.approve(r.tripId, r.userId, r.role),
                          t('share.approved', { name: r.nickname }),
                        )
                      }
                    >
                      {t('share.approve')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </section>
        )}
        <Button variant="secondary" fullWidth onClick={() => setLater(true)}>
          {t('approvals.later')}
        </Button>
      </div>
    </BottomSheet>
  );
}
