import { Lock } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { statsApi, type StatRow, type StatsReport } from '../../data/api/admin';
import { useAuth } from '../../data/authStore';
import { useTranslation } from '../../i18n';
import { EmptyState, SegmentedControl, Spinner, TopBar } from '../../shared/ui';
import { aiLabel, dataLabel, searchLabel, statLabel } from './statLabels';

type Range = '1' | '7' | '30' | '365';

/**
 * 사용 통계 (관리자만, ADR-0009): 누가 썼는지 구분하지 않은 합계·비율.
 * 칸마다 무엇을 알 수 있는지 설명을 붙이고, 영문 기능 이름은 한국어로 보여 준다 (사용자 요청 2026-11-02)
 */
export function AdminStatsPage() {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => s.me?.isAdmin === true);
  const [range, setRange] = useState<Range>('7');
  const [data, setData] = useState<StatsReport | null | undefined>(undefined);

  useEffect(() => {
    if (!isAdmin) return;
    void statsApi.report(Number(range)).then((r) => setData(r.ok ? r.data : null));
  }, [isAdmin, range]);

  const shell = (body: ReactNode) => (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('stats.title')} backTo="/me" />
      <div className="flex flex-col gap-7 px-5 pt-2">{body}</div>
    </div>
  );
  if (!isAdmin) return shell(<EmptyState icon={Lock} title={t('admin.onlyAdmin')} />);

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const ms = (v: number | null) => (v === null ? t('stats.over') : t('stats.under', { ms: v }));
  const named = (rows: StatRow[], label: (n: string) => string) =>
    rows.map((r) => ({ name: label(r.name), n: r.n }));
  // 수요: 한도 도달·AI 추천을 실제로 쓴 동작
  const demand = (rows: StatRow[]) =>
    rows.filter(
      (r) => r.name.startsWith('limit.') || /^ai\.(save|addToTrip|openMap|keywordMap)/.test(r.name),
    );

  return shell(
    <>
      <p className="rounded-card bg-bg-subtle p-3 text-caption whitespace-pre-line text-fg-sub">
        {t('stats.guide')}
      </p>
      <SegmentedControl
        label={t('stats.range')}
        value={range}
        onChange={(v) => {
          setData(undefined);
          setRange(v);
        }}
        options={(['1', '7', '30', '365'] as const).map((v) => ({
          value: v,
          label: t(`stats.d${v}`),
        }))}
      />
      {data === undefined ? (
        <Spinner />
      ) : data === null ? (
        <p className="text-body-2 text-fg-sub">{t('admin.offline')}</p>
      ) : (
        <>
          <Section title={t('stats.users')} desc={t('stats.help.users')}>
            <Numbers
              rows={[
                [t('stats.total'), data.users.total],
                [t('stats.active1'), data.users.active1],
                [t('stats.active7'), data.users.active7],
                [t('stats.active30'), data.users.active30],
              ]}
            />
            <div className="flex flex-col gap-1">
              <h3 className="text-body-2 font-semibold">{t('stats.retention')}</h3>
              {(
                [
                  [7, data.users.retention7],
                  [30, data.users.retention30],
                ] as const
              ).map(([d, r]) => (
                <p key={d} className="tabular text-body-2">
                  {t('stats.retentionRow', {
                    d,
                    pct: pct(r.back, r.base),
                    back: r.back,
                    base: r.base,
                  })}
                </p>
              ))}
            </div>
            <Bars
              title={t('stats.activeDays')}
              rows={data.users.activeDays.map((r) => ({
                name: t('stats.activeDaysUnit', { days: r.name }),
                n: r.n,
              }))}
              total={data.users.total}
            />
            <Bars
              title={t('stats.daily')}
              rows={data.users.daily.map((d) => ({ name: d.date.slice(5), n: d.n }))}
            />
            <Bars
              title={t('stats.signups')}
              rows={data.users.signups.map((d) => ({ name: d.date.slice(5), n: d.n }))}
            />
            <Bars title={t('stats.providers')} rows={data.users.providers} />
          </Section>

          <Section title={t('stats.reach')} desc={t('stats.help.reach')}>
            <Bars rows={named(data.reach, statLabel)} limit={40} />
          </Section>

          <Section title={t('stats.features')} desc={t('stats.help.events')}>
            <Bars rows={named(data.events, statLabel)} limit={40} />
          </Section>

          <Section title={t('stats.demand')} desc={t('stats.help.demand')}>
            <Bars rows={named(demand(data.events), statLabel)} />
          </Section>

          <Section title={t('stats.data')} desc={t('stats.help.data')}>
            <Bars rows={named(data.data, dataLabel)} limit={40} />
            {data.sync.length > 0 && (
              <Bars title={t('stats.sync')} rows={named(data.sync, dataLabel)} />
            )}
          </Section>

          <Section title={t('stats.trips')} desc={t('stats.help.trips')}>
            <p className="text-body-2">
              {t('stats.tripTotal', {
                n: data.trips.total,
                pct: pct(data.trips.domestic, data.trips.total),
              })}
            </p>
            <p className="text-body-2">
              {t('stats.tripAvg', { days: data.trips.avgDays, shared: data.trips.shared })}
            </p>
            <p className="text-body-2">
              {t('stats.perTrip', {
                items: data.trips.perTrip.items,
                bookings: data.trips.perTrip.bookings,
                check: data.trips.perTrip.checklistItems,
              })}
            </p>
            <Bars title={t('stats.countries')} rows={data.trips.countries} />
            <Bars title={t('stats.cities')} rows={data.trips.cities} />
          </Section>

          <Section
            title={t('stats.settings')}
            desc={`${t('stats.help.settings')}\n${t('stats.settingsDesc', { n: data.settings.users })}`}
          >
            <Bars rows={data.settings.features} total={data.settings.users} />
            <p className="text-body-2">
              {t('stats.prompt', {
                pct: pct(data.settings.prompt.on, data.settings.prompt.seen),
                on: data.settings.prompt.on,
                seen: data.settings.prompt.seen,
              })}
            </p>
            <Bars title={t('stats.domesticMap')} rows={data.settings.domesticMap} />
          </Section>

          <Section
            title={t('stats.devices')}
            desc={`${t('stats.help.devices')}\n${t('stats.devicesDesc', { n: data.devices.sessions })}`}
          >
            <Bars title={t('stats.os')} rows={data.devices.os} total={data.devices.sessions} />
            <Bars
              title={t('stats.browser')}
              rows={data.devices.browser}
              total={data.devices.sessions}
            />
            <Bars title={t('stats.env')} desc={t('stats.envDesc')} rows={data.env} limit={40} />
          </Section>

          <Section title={t('stats.hours')} desc={t('stats.help.hours')}>
            <Bars
              rows={data.users.hours.map((r) => ({ name: `${r.name}시`, n: r.n }))}
              limit={24}
            />
          </Section>

          <Section title={t('stats.aiTitle')} desc={t('stats.help.quality')}>
            <Bars rows={named(data.ai, aiLabel)} />
            <Bars title={t('stats.search')} rows={named(data.search, searchLabel)} />
          </Section>

          <Section
            title={t('stats.api')}
            desc={`${t('stats.help.quality')}\n${t('stats.apiDesc')}`}
          >
            {data.api.length === 0 ? (
              <p className="text-body-2 text-fg-muted">{t('stats.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
                {data.api.map((a) => (
                  <li key={a.route} className="flex flex-col bg-surface px-4 py-2">
                    <span className="font-mono text-caption break-all">{a.route}</span>
                    <span className="tabular text-caption text-fg-muted">
                      {t('stats.apiRow', { n: a.n, fail: a.e4 + a.e5, limit: a.limit })}
                    </span>
                    <span className="tabular text-caption text-fg-muted">
                      {t('stats.apiMs', { p50: ms(a.p50), p95: ms(a.p95) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </>,
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-body-1 font-semibold">{title}</h2>
      {desc && <p className="-mt-2 text-caption whitespace-pre-line text-fg-muted">{desc}</p>}
      {children}
    </section>
  );
}

function Numbers({ rows }: { rows: [string, number][] }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {rows.map(([label, n]) => (
        <div key={label} className="flex flex-col rounded-card bg-bg-subtle p-3">
          <dt className="text-caption text-fg-muted">{label}</dt>
          <dd className="tabular text-title-2">{n.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 이름 + 막대 + 횟수. total을 주면 비율(%)도 */
function Bars({
  title,
  desc,
  rows,
  total,
  limit = 20,
}: {
  title?: string;
  desc?: string;
  rows: StatRow[];
  total?: number;
  limit?: number;
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="flex flex-col gap-1.5">
      {title && <h3 className="text-body-2 font-semibold">{title}</h3>}
      {desc && <p className="text-caption text-fg-muted">{desc}</p>}
      {rows.length === 0 ? (
        <p className="text-caption text-fg-muted">{t('stats.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.slice(0, limit).map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex flex-col gap-0.5">
              <span className="flex items-baseline justify-between gap-2 text-caption">
                <span className="min-w-0 break-all">{r.name}</span>
                <span className="tabular shrink-0 text-fg-sub">
                  {r.n.toLocaleString()}
                  {total ? ` · ${Math.round((r.n / Math.max(1, total)) * 100)}%` : ''}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
