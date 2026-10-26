import { useEffect, useState, type ReactNode } from 'react';
import { apiUsageApi, type ApiUsage, type ApiUsageReport } from '../../data/api/admin';
import { remainingRatio, remainingTone } from '../../domain/apiRemaining';
import { useAuth } from '../../data/authStore';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { Button, EmptyState, Spinner, TopBar, toast } from '../../shared/ui';

type Update = { paused?: boolean; limit?: number | null; dailyLimit?: number | null };

/**
 * API 사용량 (관리자만): 앱이 부르는 외부 API 전부.
 * 무료 사용량을 아는 API는 월·하루 사용량 대비 %·자동 중지 상한·하루별 막대, 나머지는 호출 수.
 * 과금 가능 / 무료(나중에 유료로 바뀔 수 있음)로 나누고, 로그인·프록시 외에는 모두 수동 중지/다시 켜기
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

  const hasLimit = (a: ApiUsage) => a.freeMonthly !== null || a.freeDaily !== null;
  const section = (group: ApiUsage['group']) => {
    const apis = data.apis.filter((a) => a.group === group);
    const rows = apis.filter((a) => !hasLimit(a));
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-caption font-bold text-fg-muted">{t(`apiUsage.${group}`)}</h2>
        {group === 'free' && <p className="text-caption text-fg-muted">{t('apiUsage.freeDesc')}</p>}
        {/* 남은 무료량이 적은 것부터 (사용자 요청 2026-10-27) */}
        {apis
          .filter(hasLimit)
          .sort((x, y) => (remainingRatio(x) ?? 1) - (remainingRatio(y) ?? 1))
          .map((a) => (
            <LimitCard
              key={a.id}
              api={a}
              busy={busy === a.id}
              onUpdate={(b) => void update(a.id, b)}
            />
          ))}
        {rows.length > 0 && (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
            {rows.map((a) => (
              <li key={a.id} className="flex min-h-14 items-center gap-2 bg-surface px-4 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-2 font-medium">{apiName(t, a.id)}</span>
                  <span className="text-caption text-fg-muted">{apiNote(t, a.id)}</span>
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
        )}
      </section>
    );
  };
  return shell(
    <>
      <p className="text-caption text-fg-muted">{t('apiUsage.desc', { month: data.month })}</p>
      {section('paid')}
      {section('free')}
    </>,
  );
}

type T = ReturnType<typeof useTranslation>['t'];
const apiName = (t: T, id: string) => t(`apiUsage.name.${id}` as 'apiUsage.name.groq');
const apiNote = (t: T, id: string) => t(`apiUsage.note.${id}` as 'apiUsage.note.groq');

function LimitCard({
  api: a,
  busy,
  onUpdate,
}: {
  api: ApiUsage;
  busy: boolean;
  onUpdate: (b: Update) => void;
}) {
  const { t } = useTranslation();
  // 남은 무료량 20% 미만 옅은 주황, 5% 미만 옅은 빨강
  const tone = remainingTone(remainingRatio(a));
  const state = a.paused
    ? 'paused'
    : a.autoStoppedBy === 'day'
      ? 'autoStoppedDay'
      : a.autoStopped
        ? 'autoStopped'
        : 'running';
  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-card border border-line p-4',
        tone === 'danger' && 'border-danger/40 bg-danger/10',
        tone === 'warning' && 'border-warning/40 bg-warning/10',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-body-1 font-semibold">{apiName(t, a.id)}</h3>
          <p className="text-caption text-fg-muted">{apiNote(t, a.id)}</p>
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
      {a.freeMonthly !== null && (
        <Meter
          label={t('apiUsage.monthMeter')}
          name={apiName(t, a.id)}
          used={a.used}
          free={a.freeMonthly}
          limit={a.autoLimit}
        />
      )}
      {a.freeDaily !== null && (
        <Meter
          label={t('apiUsage.dayMeter')}
          name={apiName(t, a.id)}
          used={a.today}
          free={a.freeDaily}
          limit={a.dailyLimit}
        />
      )}
      <DailyBars daily={a.daily} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {a.freeMonthly !== null && (
          <LimitInput
            label={t('apiUsage.autoLimit')}
            value={a.autoLimit}
            onChange={(limit) => onUpdate({ limit })}
          />
        )}
        {a.freeDaily !== null && (
          <LimitInput
            label={t('apiUsage.dailyLimit')}
            value={a.dailyLimit}
            onChange={(dailyLimit) => onUpdate({ dailyLimit })}
          />
        )}
        <span className="ml-auto">
          <ToggleButton api={a} busy={busy} onUpdate={onUpdate} />
        </span>
      </div>
    </article>
  );
}

/** 무료 사용량 대비 % — 세로선 = 자동 중지 상한 */
function Meter({
  label,
  name,
  used,
  free,
  limit,
}: {
  label: string;
  name: string;
  used: number;
  free: number;
  limit: number | null;
}) {
  const { t } = useTranslation();
  const pct = free ? (used / free) * 100 : 0;
  const limitPct = free && limit !== null ? Math.min(100, (limit / free) * 100) : null;
  return (
    <div className="flex flex-col gap-1">
      <div
        role="meter"
        aria-label={t('apiUsage.meterOf', { name: `${name} ${label}` })}
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
        <span className="text-fg-muted">{label}</span>
        <span className="font-semibold">
          {used.toLocaleString()} / {free.toLocaleString()} ({formatPct(pct)})
        </span>
      </p>
    </div>
  );
}

function LimitInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-caption text-fg-sub">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        defaultValue={value ?? ''}
        onBlur={(e) => {
          const v = e.currentTarget.value.trim();
          const next = v === '' ? null : Math.max(0, Math.floor(Number(v)));
          if (next !== value && (next === null || Number.isFinite(next))) onChange(next);
        }}
        className="tabular h-9 w-24 rounded-btn bg-bg-subtle px-2 text-right text-caption"
      />
    </label>
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
  // 로그인·프록시는 멈추면 앱이 안 되므로 기록만
  if (!a.pausable)
    return <span className="shrink-0 text-caption text-fg-muted">{t('apiUsage.recordOnly')}</span>;
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
