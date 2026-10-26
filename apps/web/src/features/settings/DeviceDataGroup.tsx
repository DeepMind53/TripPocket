import { useEffect, useState } from 'react';
import { useTrips } from '../../data/hooks';
import { setPassportExpiry, usePassportExpiry } from '../../data/passportExpiry';
import { attachmentRepo } from '../../data/repositories/attachmentRepo';
import { clearReviewQueue, queuedReviews } from '../../data/reviewQueue';
import { useTranslation } from '../../i18n';
import { toast } from '../../shared/ui';

/**
 * 설정 → 기기 데이터 정리 (사용자 요청 2026-10-25): 사용자가 넣어 **이 기기에만** 있는 것을 종류별로 지운다.
 * 서버 데이터는 여기서 지우지 않는다 — 관리자만, 서버 PC에서 (apps/server `pnpm admin:data`)
 */
export function DeviceDataGroup() {
  const { t } = useTranslation();
  const trips = useTrips();
  const passport = usePassportExpiry((s) => s.value);
  const [docs, setDocs] = useState<{ ids: string[]; bytes: number } | null>(null);
  const [queue, setQueue] = useState(() => queuedReviews().length);
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    if (!trips) return;
    void attachmentRepo.pastTripDocs(trips).then((rows) =>
      setDocs({
        ids: rows.map((r) => r.id),
        bytes: rows.reduce((s, r) => s + (r.blob ? r.size : 0), 0),
      }),
    );
  }, [trips]);

  // 두 번 눌러야 지움 (3초 안에)
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(null), 3000);
    return () => window.clearTimeout(id);
  }, [armed]);
  const confirm = (key: string, run: () => void | Promise<void>) => {
    if (armed !== key) return setArmed(key);
    setArmed(null);
    void Promise.resolve(run()).then(() => toast(t('deviceData.cleared')));
  };

  const rows = [
    {
      key: 'pastDocs',
      label: t('deviceData.pastDocs'),
      value: docs
        ? t('deviceData.docsValue', {
            n: docs.ids.length,
            mb: (docs.bytes / 1024 / 1024).toFixed(1),
          })
        : '…',
      empty: !docs || docs.ids.length === 0,
      run: async () => {
        if (!docs) return;
        await attachmentRepo.removeLocal(docs.ids);
        setDocs({ ids: [], bytes: 0 });
      },
    },
    {
      key: 'passport',
      label: t('deviceData.passport'),
      value: passport ? t('deviceData.saved') : t('deviceData.none'),
      empty: !passport,
      run: () => setPassportExpiry(null),
    },
    {
      key: 'reviewQueue',
      label: t('deviceData.reviewQueue'),
      value: t('deviceData.count', { n: queue }),
      empty: queue === 0,
      run: () => {
        clearReviewQueue();
        setQueue(0);
      },
    },
  ];

  return (
    <section aria-label={t('deviceData.title')} className="flex flex-col gap-2">
      <h2 className="px-1 text-caption font-bold text-fg-muted">{t('deviceData.title')}</h2>
      <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
        <p className="pb-2 text-caption text-fg-muted">{t('deviceData.desc')}</p>
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="flex min-h-12 items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-body-2 font-medium">{r.label}</span>
                <span className="tabular text-caption text-fg-muted">{r.value}</span>
              </span>
              <button
                type="button"
                disabled={r.empty}
                onClick={() => confirm(r.key, r.run)}
                className={`h-10 shrink-0 rounded-btn px-3 text-caption font-semibold disabled:opacity-40 ${
                  armed === r.key ? 'bg-danger text-white' : 'bg-bg-subtle text-danger'
                }`}
              >
                {armed === r.key ? t('deviceData.confirm') : t('deviceData.clear')}
              </button>
            </li>
          ))}
        </ul>
        <p className="pt-2 text-micro text-fg-muted">{t('deviceData.serverNote')}</p>
      </div>
    </section>
  );
}
