import { useEffect, useState, type ReactNode } from 'react';
import { apiUsageApi, type ApiUsage, type ApiUsageReport } from '../../data/api/admin';
import { useAuth } from '../../data/authStore';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { Button, EmptyState, Spinner, TopBar, toast } from '../../shared/ui';

type Update = { paused?: boolean; limit?: number | null };

/**
 * API 사용량 (관리자만): 과금될 수 있는 API는 무료 월 사용량 대비 %·자동 중지 상한·하루별 막대,
 * 무료 API는 이번 달·오늘 호출 수. 모두 수동 중지/다시 켜기
 */
export function ApiUsagePage() {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => s.me?.isAdmin === true);
  const [data, setData] = useState<ApiUsageReport | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) void apiUsageApi.report().then((r) => setData(r.ok ? r.data : null));
  }, [isAdmin]);

  async function update(id: string, body: Update) {
    setBusy(id);
    const res = await apiUsageApi.update(id, body);
    setBusy(null);
    if (res.ok) setData(res.data);
    else toast(t('admin.failed'));
  }

  const shell = (body: ReactNode) => (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('apiUsage.title')} backTo="/me" />
      <div className="flex flex-col gap-6 px-5 pt-2">{body}</div>
    </div>
  );
  if (!isAdmin) return shell(<EmptyState emoji="🔒" title={t('admin.onlyAdmin')} />);
  if (data === undefined) return shell(<Spinner />);
  if (data === null) return shell(<p className="text-body-2 text-fg-sub">{t('admin.offline')}</p>);

  const paid = data.apis.filter((a) => a.group === 'paid');
  const free = data.apis.filter((a) => a.group === 'free');
  return shell(
    <>
      <p className="text-caption text-fg-muted">{t('apiUsage.desc', { month: data.month })}</p>
      <section className="flex flex-col gap-3">
        <h2 className="text-caption font-bold text-fg-muted">{t('apiUsage.paid')}</h2>
        {paid.map((a) => (
          <PaidCard
            key={a.id}
            api={a}
            busy={busy === a.id}
            onUpdate={(b) => void update(a.id, b)}
          />
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-caption font-bold text-fg-muted">{t('apiUsage.free')}</h2>
        <p className="text-caption text-fg-muted">{t('apiUsage.freeDesc')}</p>
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
          {free.map((a) => (
            <li key={a.id} className="flex min-h-14 items-center gap-2 bg-surface px-4 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-2 font-medium">{apiName(t, a.id)}</span>
                <span className="tabular text-caption text-fg-muted">
                  {t('apiUsage.counts', {
                    month: a.used.toLocaleString(),
                    today: a.today.toLocaleString(),
                  })}
                  {a.paused && ` · ${t('apiUsage.paused')}`}
                </span>
              </span>
              <ToggleButton api={a} busy={busy === a.id} onUpdate={(b) => void update(a.id, b)} />
            </li>
          ))}
        </ul>
      </section>
    </>,
  );
}

type T = ReturnType<typeof useTranslation>['t'];
const apiName = (t: T, id: string) => t(`apiUsage.name.${id}` as 'apiUsage.name.groq');

function PaidCard({
  api: a,
  busy,
  onUpdate,
}: {
  api: ApiUsage;
  busy: boolean;
  onUpdate: (b: Update) => void;
}) {
  const { t } = useTranslation();
  const free = a.freeMonthly ?? 0;
  const pct = free ? (a.used / free) * 100 : 0;
  const limitPct = free && a.autoLimit !== null ? Math.min(100, (a.autoLimit / free) * 100) : null;
  const state = a.paused ? 'paused' : a.autoStopped ? 'autoStopped' : 'running';
  return (
    <article className="flex flex-col gap-2 rounded-card border border-line p-4">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-body-1 font-semibold">{apiName(t, a.id)}</h3>
          <p className="text-caption text-fg-muted">
            {t(`apiUsage.note.${a.id}` as 'apiUsage.note.naver_search')}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-micro font-bold',
            state === 'running' ? 'bg-success/15 text-success' : 'bg-warning/20 text-warning',
          )}
        >
          {t(`apiUsage.${state}`)}
        </span>
      </div>
      {/* 무료 월 사용량 대비 % — 세로선 = 자동 중지 상한 */}
      <div
        role="meter"
        aria-label={t('apiUsage.meterOf', { name: apiName(t, a.id) })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="relative h-3 overflow-hidden rounded-full bg-bg-subtle"
      >
        <div
          className={cn(
            'h-full rounded-full',
            limitPct !== null && pct >= limitPct ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        {limitPct !== null && (
          <div className="absolute inset-y-0 w-0.5 bg-fg-muted" style={{ left: `${limitPct}%` }} />
        )}
      </div>
      <p className="tabular flex justify-between text-caption">
        <span className="font-semibold">
          {a.used.toLocaleString()} / {free.toLocaleString()} ({formatPct(pct)})
        </span>
        <span className="text-fg-muted">
          {t('apiUsage.today', { n: a.today.toLocaleString() })}
        </span>
      </p>
      <DailyBars daily={a.daily} />
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 text-caption text-fg-sub">
          {t('apiUsage.autoLimit')}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={a.autoLimit ?? ''}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              const next = v === '' ? null : Math.max(0, Math.floor(Number(v)));
              if (next !== a.autoLimit && (next === null || Number.isFinite(next)))
                onUpdate({ limit: next });
            }}
            className="tabular h-9 w-24 rounded-btn bg-bg-subtle px-2 text-right text-caption"
          />
        </label>
        <ToggleButton api={a} busy={busy} onUpdate={onUpdate} />
      </div>
    </article>
  );
}

/** 0.01% 같은 작은 값도 보이게 */
const formatPct = (p: number) => `${p > 0 && p < 1 ? p.toFixed(2) : p.toFixed(1)}%`;

/** 이번 달 하루별 사용량 막대 (1일 ~ 말일) */
function DailyBars({ daily }: { daily: { date: string; count: number }[] }) {
  const { t } = useTranslation();
  const first = daily[0];
  if (!first) return null;
  const max = Math.max(...daily.map((d) => d.count), 1);
  const byDay = new Map(daily.map((d) => [Number(d.date.slice(8, 10)), d.count]));
  const days = new Date(
    Number(first.date.slice(0, 4)),
    Number(first.date.slice(5, 7)),
    0,
  ).getDate();
  return (
    <svg
      viewBox={`0 0 ${days * 4} 24`}
      preserveAspectRatio="none"
      className="h-8 w-full text-primary"
      role="img"
      aria-label={t('apiUsage.dailyChart')}
    >
      {Array.from({ length: days }, (_, i) => {
        const n = byDay.get(i + 1) ?? 0;
        const h = n ? Math.max(1, (n / max) * 24) : 0;
        return <rect key={i} x={i * 4 + 0.5} y={24 - h} width={3} height={h} fill="currentColor" />;
      })}
    </svg>
  );
}

function ToggleButton({
  api: a,
  busy,
  onUpdate,
}: {
  api: ApiUsage;
  busy: boolean;
  onUpdate: (b: Update) => void;
}) {
  const { t } = useTranslation();
  return (
    <Button
      size="sm"
      variant={a.paused ? 'primary' : 'secondary'}
      loading={busy}
      onClick={() => onUpdate({ paused: !a.paused })}
      aria-label={t(a.paused ? 'apiUsage.resumeOf' : 'apiUsage.pauseOf', {
        name: apiName(t, a.id),
      })}
    >
      {t(a.paused ? 'apiUsage.resume' : 'apiUsage.pause')}
    </Button>
  );
}
