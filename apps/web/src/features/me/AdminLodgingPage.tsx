import { nightlyOf, type LodgingReportView } from '@trippocket/shared';
import { Lock, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  apiUsageApi,
  lodgingAdminApi,
  type LodgingAdmin,
  type LodgingSource,
} from '../../data/api/admin';
import { useAuth } from '../../data/authStore';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { Button, confirmDelete, EmptyState, Spinner, TopBar, toast } from '../../shared/ui';

type State = 'noKey' | 'paused' | 'auto' | 'off' | 'quota' | 'breaker' | 'ok';

/** 소스 상태 한 가지 (가장 먼저 손봐야 할 것부터) */
const stateOf = (s: LodgingSource): State =>
  !s.configured
    ? 'noKey'
    : s.paused
      ? 'paused'
      : s.autoStopped
        ? 'auto'
        : s.breaker.off
          ? 'off'
          : s.breaker.quota
            ? 'quota'
            : s.breaker.paused
              ? 'breaker'
              : 'ok';

/**
 * 숙소 최저가 관리 (관리자만, docs/28 §14 6단계): 외부 소스(아고다 자동 찾기·SerpApi) 상태·사용량,
 * 멈추기/다시 켜기(API 사용량과 같은 스위치), 차단기 풀기, 가격 기록 정리. 작성자는 보이지 않는다.
 * 요청은 화면을 열 때 1번 + 누를 때만
 */
export function AdminLodgingPage() {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => s.me?.isAdmin === true);
  const [data, setData] = useState<LodgingAdmin | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () =>
    lodgingAdminApi.report().then((r) => {
      setData(r.ok ? r.data : null);
    });
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const act = async (id: string, run: () => Promise<{ ok: boolean }>, done?: string) => {
    setBusy(id);
    const res = await run();
    if (res.ok) {
      if (done) toast(done);
      await load();
    } else toast(t('admin.failed'));
    setBusy(null);
  };

  const shell = (body: ReactNode) => (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('lodgingAdmin.title')} backTo="/me" />
      <div className="flex flex-col gap-6 px-5 pt-2">{body}</div>
    </div>
  );
  if (!isAdmin) return shell(<EmptyState icon={Lock} title={t('admin.onlyAdmin')} />);
  if (data === undefined) return shell(<Spinner />);
  if (data === null) return shell(<p className="text-body-2 text-fg-sub">{t('admin.offline')}</p>);

  const remove = async (r: LodgingReportView) => {
    if (!(await confirmDelete(t('lodgingAdmin.confirmDelete')))) return;
    await act(r.id, () => lodgingAdminApi.remove(r.id));
  };
  const siteLabel = (r: LodgingReportView) =>
    r.site === 'agoda' && r.route
      ? `${t('lodgingPrice.app.agoda')} · ${t(`lodgingPrice.route.${r.route}` as 'lodgingPrice.route.default')}`
      : t(`lodgingPrice.app.${r.site}`);

  return shell(
    <>
      <p className="text-caption whitespace-pre-line text-fg-muted">{t('lodgingAdmin.desc')}</p>
      <section aria-label={t('lodgingAdmin.sources')} className="flex flex-col gap-3">
        <h2 className="text-body-1 font-semibold">{t('lodgingAdmin.sources')}</h2>
        {data.sources.map((s) => {
          const state = stateOf(s);
          return (
            <article
              key={s.id}
              aria-label={t(`apiUsage.name.${s.id}`)}
              className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 text-body-1 font-semibold">{t(`apiUsage.name.${s.id}`)}</h3>
                <span
                  className={`shrink-0 text-caption font-semibold ${state === 'ok' ? 'text-success' : 'text-warning'}`}
                >
                  {t(`lodgingAdmin.state.${state}`, {
                    time:
                      s.breaker.until !== null
                        ? new Date(s.breaker.until).toLocaleString('ko', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '',
                  })}
                </span>
              </div>
              <p className="tabular text-caption whitespace-pre-line text-fg-sub">
                {[
                  t('lodgingAdmin.usage', { month: s.used, today: s.today }),
                  s.autoLimit !== null
                    ? t('lodgingAdmin.monthLimit', { n: s.autoLimit })
                    : s.dailyLimit !== null
                      ? t('lodgingAdmin.dayLimit', { n: s.dailyLimit })
                      : null,
                  s.hourly !== undefined
                    ? t('lodgingAdmin.hour', { n: s.lastHour ?? 0, max: s.hourly })
                    : null,
                  t('lodgingAdmin.cache', { n: s.cacheSize }),
                ]
                  .filter(Boolean)
                  .join('\n')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === s.id || !s.configured}
                  onClick={() =>
                    void act(s.id, () => apiUsageApi.update(s.id, { paused: !s.paused }))
                  }
                >
                  {s.paused ? t('lodgingAdmin.resume') : t('lodgingAdmin.pause')}
                </Button>
                {s.breaker.paused && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === s.id}
                    onClick={() =>
                      void act(
                        s.id,
                        () => lodgingAdminApi.resume(s.id),
                        t('lodgingAdmin.unblocked'),
                      )
                    }
                  >
                    {t('lodgingAdmin.unblock')}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section aria-label={t('lodgingAdmin.reports')} className="flex flex-col gap-2">
        <h2 className="flex items-baseline justify-between gap-2 text-body-1 font-semibold">
          {t('lodgingAdmin.reports')}
          <span className="tabular text-caption font-normal text-fg-muted">
            {t('lodgingAdmin.total', { n: data.reports.total })}
          </span>
        </h2>
        {data.reports.recent.length === 0 ? (
          <p className="rounded-card bg-bg-subtle px-3 py-3 text-caption text-fg-sub">
            {t('lodgingAdmin.none')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface px-3">
            {data.reports.recent.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-2 font-medium">{r.hotelName}</span>
                  <span className="truncate text-caption text-fg-sub">{siteLabel(r)}</span>
                  <span className="tabular text-micro text-fg-muted">
                    {t('lodgingAdmin.row', {
                      checkIn: formatMonthDay(r.checkIn),
                      nights: r.nights,
                      adults: r.adults,
                      seen: formatMonthDay(r.seenOn),
                    })}
                  </span>
                </span>
                <span className="tabular shrink-0 text-body-2 font-medium">
                  {t('lodgingAdmin.price', {
                    price: new Intl.NumberFormat('ko').format(nightlyOf(r)),
                    cur: r.currency,
                  })}
                </span>
                <button
                  type="button"
                  aria-label={t('lodgingAdmin.deleteLabel', { name: r.hotelName })}
                  disabled={busy === r.id}
                  onClick={() => void remove(r)}
                  className="grid size-10 shrink-0 place-items-center rounded-btn text-fg-sub"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>,
  );
}
