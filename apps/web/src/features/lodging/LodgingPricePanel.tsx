import { todayIn, type LodgingReportView, type LodgingSite } from '@trippocket/shared';
import { Clipboard, Copy, ExternalLink, History, PencilLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { loadReports, removeReport } from '../../data/lodgingReports';
import { lookupAgoda, type AgodaCandidate, type LookupResult } from '../../data/agodaLookup';
import { reportQueryOf } from './reportQuery';
import { loadRecentStays, saveRecentStay, type RecentStay } from '../../data/lodgingRecent';
import { cachedFx } from '../../data/services/fxService';
import {
  arrangeReports,
  cheapRoute,
  latestByRoute,
  type ArrangedReport,
} from '../../domain/lodgingReports';
import { ReportFormSheet, type ReportTarget } from './ReportFormSheet';
import { ReportsSection } from './ReportsSection';
import {
  AGODA_DEFAULT_CID,
  AGODA_PROMOS,
  AGODA_ROUTES,
  agodaPromoUrl,
  agodaLinkOf,
  agodaRouteUrl,
  parseAgodaLink,
  type AgodaBase,
  type AgodaRouteGroup,
  type AgodaRouteId,
} from '../../domain/agodaRoutes';
import {
  appLinks,
  STAY_LIMITS,
  stayQueryError,
  type AppLink,
  type StayQuery,
} from '../../domain/lodgingLinks';
import { useTranslation } from '../../i18n';
import { copyText } from '../../shared/lib/clipboard';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { countUse } from '../../shared/lib/usageCount';
import {
  Button,
  Chip,
  confirmDelete,
  ScrollRow,
  SegmentedControl,
  Stepper,
  toast,
} from '../../shared/ui';

/** 자동 찾기 실패 이유 (none = 결과 0개) */
type LookupFail = Extract<LookupResult, { ok: false }>['reason'] | 'none';

type PanelReports =
  | { status: 'idle' | 'loading' | 'offline' | 'error' }
  | { status: 'ready'; list: LodgingReportView[] };

const inputClass =
  'h-12 w-full min-w-0 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary';

type Group = 'all' | AgodaRouteGroup;
const GROUPS: readonly Group[] = ['all', 'search', 'card', 'airline'];

/**
 * 숙소 최저가 (실험실, docs/28): 숙소 이름·날짜 → 아고다 경로별 링크 + 예약 앱 링크.
 * 가격은 사용자가 눌러서 각 앱에서 보고, 본 가격을 적으면 30일 동안 모두가 본다 (docs/28 §7).
 * 서버 요청은 [검색]을 누를 때 기록 목록 1번뿐 (data/lodgingReports.ts가 잠금·5분 재사용·시간 제한·취소)
 */
export function LodgingPricePanel({ initial }: { initial: Partial<RecentStay> }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name ?? '');
  const [checkIn, setCheckIn] = useState(initial.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(initial.checkOut ?? '');
  const [adults, setAdults] = useState(initial.adults ?? 2);
  const [rooms, setRooms] = useState(initial.rooms ?? 1);
  const [agodaText, setAgodaText] = useState(initial.agoda ?? '');
  // 국내·해외에 따라 여기어때 주소가 다르다 — 처음 값은 여행지 기준 (2026-11-09 사용자 제보)
  const [domestic, setDomestic] = useState(initial.domestic ?? false);
  const [recent, setRecent] = useState(loadRecentStays);
  const [result, setResult] = useState<{
    q: StayQuery;
    agoda: AgodaBase | null;
    domestic: boolean;
    /** 자동 찾기 결과 (링크를 넣었으면 없음) */
    found?: { candidates: AgodaCandidate[]; failed: LookupFail | null };
  } | null>(null);
  // 아고다 링크 칸은 자동으로 못 찾았을 때만 연다 (사용자 요청 2026-11-09)
  const [manual, setManual] = useState(!!initial.agoda);
  const [reports, setReports] = useState<PanelReports>({ status: 'idle' });
  const [rates, setRates] = useState<Record<string, number> | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  // 화면을 닫으면 진행 중인 요청 취소 (요청을 새로 만들지는 않는다)
  useEffect(() => () => abort.current?.abort(), []);

  const draft: StayQuery = { name: name.trim(), checkIn, checkOut, adults, rooms };
  const error = stayQueryError(draft);
  const agodaBad = agodaText.trim() !== '' && !parseAgodaLink(agodaText);

  const fill = (s: RecentStay) => {
    setName(s.name);
    setCheckIn(s.checkIn);
    setCheckOut(s.checkOut);
    setAdults(s.adults);
    setRooms(s.rooms);
    setAgodaText(s.agoda ?? '');
    if (s.domestic !== undefined) setDomestic(s.domestic);
    setResult(null);
  };

  /** 기록 목록: 누를 때 한 번 (실패해도 다시 부르지 않는다) */
  const loadList = (q: StayQuery, agoda: AgodaBase | null, ctrl: AbortController) =>
    Promise.all([loadReports(reportQueryOf(q, agoda), ctrl.signal), cachedFx()]).then(
      ([res, fx]) => {
        if (ctrl.signal.aborted) return;
        setRates(fx?.rates);
        setReports(
          res.ok
            ? { status: 'ready', list: res.reports }
            : { status: res.reason === 'offline' ? 'offline' : 'error' },
        );
      },
    );

  const search = async () => {
    if (error || agodaBad || reports.status === 'loading') return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setReports({ status: 'loading' });
    countUse('lodgingPrice.search');
    const q = draft;
    // 아고다: 붙여 넣은 링크 → 없으면 이름으로 자동 찾기 (서버 1번, 못 찾으면 링크 칸을 연다)
    let agoda = parseAgodaLink(agodaText);
    let found: { candidates: AgodaCandidate[]; failed: LookupFail | null } | undefined;
    if (!agoda) {
      const res = await lookupAgoda(q.name, ctrl.signal);
      if (ctrl.signal.aborted) return;
      found = res.ok
        ? { candidates: res.candidates, failed: res.candidates.length ? null : 'none' }
        : { candidates: [], failed: res.reason };
      const first = found.candidates[0];
      agoda = first ? { hid: first.hid } : null;
      if (!first) setManual(true);
    }
    setResult({ q, agoda, domestic, ...(found ? { found } : {}) });
    setRecent(
      saveRecentStay({
        ...q,
        domestic,
        ...(agoda ? { agoda: agodaText.trim() || agodaLinkOf(agoda) } : {}),
      }),
    );
    await loadList(q, agoda, ctrl);
  };

  /** 자동으로 찾은 후보 중 다른 숙소를 고르면 그 숙소로 링크·기록을 다시 (누를 때 한 번) */
  const pick = (c: AgodaCandidate) => {
    if (!result || reports.status === 'loading') return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const agoda = { hid: c.hid };
    setResult({ ...result, agoda });
    setReports({ status: 'loading' });
    void loadList(result.q, agoda, ctrl);
  };

  const paste = async () => {
    try {
      setAgodaText(await navigator.clipboard.readText());
    } catch {
      toast(t('lodgingPrice.pasteFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {recent.length > 0 && (
        <section aria-label={t('lodgingPrice.recent')} className="flex flex-col gap-1.5">
          <h3 className="flex items-center gap-1 text-caption font-semibold text-fg-muted">
            <History aria-hidden="true" className="size-3.5" />
            {t('lodgingPrice.recent')}
          </h3>
          <ScrollRow className="flex gap-2 pb-1">
            {recent.map((s) => (
              <Chip key={`${s.name}-${s.checkIn}-${s.checkOut}`} onClick={() => fill(s)}>
                <span className="max-w-40 truncate">{s.name}</span>
                <span className="tabular text-fg-muted">{formatMonthDay(s.checkIn)}</span>
              </Chip>
            ))}
          </ScrollRow>
        </section>
      )}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-fg-sub">{t('lodgingPrice.name')}</span>
          <input
            value={name}
            maxLength={STAY_LIMITS.nameMax}
            placeholder={t('lodgingPrice.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <SegmentedControl
          label={t('lodgingPrice.region')}
          value={domestic ? 'domestic' : 'overseas'}
          onChange={(v) => setDomestic(v === 'domestic')}
          options={[
            { value: 'domestic', label: t('lodgingPrice.domestic') },
            { value: 'overseas', label: t('lodgingPrice.overseas') },
          ]}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-caption font-semibold text-fg-sub">
              {t('lodgingPrice.checkIn')}
            </span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className={`${inputClass} tabular px-2`}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-caption font-semibold text-fg-sub">
              {t('lodgingPrice.checkOut')}
            </span>
            <input
              type="date"
              value={checkOut}
              min={checkIn || undefined}
              onChange={(e) => setCheckOut(e.target.value)}
              className={`${inputClass} tabular px-2`}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="flex items-center gap-2">
            <span className="text-caption font-semibold text-fg-sub">
              {t('lodgingPrice.adults')}
            </span>
            <Stepper
              label={t('lodgingPrice.adults')}
              value={adults}
              min={1}
              max={STAY_LIMITS.adultsMax}
              onChange={setAdults}
            />
          </span>
          <span className="flex items-center gap-2">
            <span className="text-caption font-semibold text-fg-sub">
              {t('lodgingPrice.rooms')}
            </span>
            <Stepper
              label={t('lodgingPrice.rooms')}
              value={rooms}
              min={1}
              max={STAY_LIMITS.roomsMax}
              onChange={setRooms}
            />
          </span>
        </div>
        {manual ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-fg-sub">
              {t('lodgingPrice.agodaLink')}
            </span>
            <span className="flex gap-2">
              <input
                value={agodaText}
                inputMode="url"
                placeholder={t('lodgingPrice.agodaPlaceholder')}
                onChange={(e) => setAgodaText(e.target.value)}
                className={inputClass}
              />
              <Button
                type="button"
                variant="secondary"
                className="h-12! shrink-0 px-3!"
                onClick={() => void paste()}
              >
                <Clipboard aria-hidden="true" className="size-4" />
                {t('lodgingPrice.paste')}
              </Button>
            </span>
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setManual(true)}
            className="flex min-h-10 items-center self-start text-caption font-semibold text-primary"
          >
            {t('lodgingPrice.agodaManual')}
          </button>
        )}
        {(agodaBad || (error && error !== 'name' && checkIn && checkOut)) && (
          <p role="alert" className="text-caption whitespace-pre-line text-danger">
            {agodaBad ? t('lodgingPrice.errAgoda') : t(`lodgingPrice.err.${error!}`)}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={!!error || agodaBad || reports.status === 'loading'}
        >
          {reports.status === 'loading' ? t('lodgingPrice.searching') : t('lodgingPrice.search')}
        </Button>
      </form>

      {result && (
        <Results
          q={result.q}
          agoda={result.agoda}
          domestic={result.domestic}
          found={result.found}
          onPick={pick}
          reports={reports}
          rates={rates}
          onReports={(list) => setReports({ status: 'ready', list })}
        />
      )}
    </div>
  );
}

/** 링크를 누르고 이 시간 안에 앱으로 돌아오면 그 줄에 [적기]를 한 번 띄운다 (docs/28 I6) */
const RETURN_MS = 10 * 60_000;

function Results({
  q,
  agoda,
  domestic,
  found,
  onPick,
  reports,
  rates,
  onReports,
}: {
  q: StayQuery;
  agoda: AgodaBase | null;
  domestic: boolean;
  found: { candidates: AgodaCandidate[]; failed: LookupFail | null } | undefined;
  onPick: (c: AgodaCandidate) => void;
  reports: PanelReports;
  rates: Record<string, number> | undefined;
  onReports: (list: LodgingReportView[]) => void;
}) {
  const { t } = useTranslation();
  const [group, setGroup] = useState<Group>('all');
  const query = reportQueryOf(q, agoda);
  const stay = { checkIn: q.checkIn, nights: query.nights, adults: q.adults };
  const arranged = reports.status === 'ready' ? arrangeReports(reports.list, stay, rates) : null;
  const byRoute = arranged ? latestByRoute(arranged.same) : new Map<string, ArrangedReport>();
  const winner = arranged ? cheapRoute([...arranged.same, ...arranged.other]) : null;
  const today = todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const canWrite = reports.status === 'ready';
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ id: string; at: number } | null>(null);
  // 화면이 다시 보이면 마지막에 연 링크 줄에 [적기] (요청 없음, 한 번만)
  useEffect(() => {
    if (!opened) return;
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      setOpened(null);
      if (Date.now() - opened.at < RETURN_MS) setPrompt(opened.id);
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [opened]);

  const siteLabel = (site: LodgingSite, route?: string) =>
    site === 'agoda' && route
      ? `${t('lodgingPrice.app.agoda')} · ${t(`lodgingPrice.route.${route as AgodaRouteId}`)}`
      : site === 'other'
        ? t('lodgingPrice.app.other')
        : t(`lodgingPrice.app.${site}`);
  const rowProps = (id: string, site: LodgingSite, route?: string) => ({
    write: canWrite ? () => setTarget({ site, route, label: siteLabel(site, route) }) : undefined,
    prompt: prompt === id && canWrite,
    onOpened: () => {
      setOpened({ id, at: Date.now() });
      setPrompt(null);
    },
  });
  const recentText = (route: string) => {
    const r = byRoute.get(route);
    return r?.nightlyKrw != null
      ? t('lodgingPrice.reports.recent', {
          price: new Intl.NumberFormat('ko').format(r.nightlyKrw),
          date: formatMonthDay(r.seenOn),
        })
      : undefined;
  };
  const remove = async (r: ArrangedReport) => {
    if (!(await confirmDelete(t('lodgingPrice.reports.confirmDelete')))) return;
    const res = await removeReport(r.id, query);
    if (res.ok) onReports(res.reports);
    else toast(t(`lodgingPrice.report.fail.${res.reason}`));
  };
  const routes = AGODA_ROUTES.filter((r) => group === 'all' || r.group === group);
  const count = (g: Group) =>
    g === 'all' ? AGODA_ROUTES.length + 1 : AGODA_ROUTES.filter((r) => r.group === g).length;
  // 아고다 숙소를 알면 아고다 버튼도 그 숙소의 기본 경로로
  const apps: AppLink[] = appLinks(q, { domestic }).map((l) =>
    l.app === 'agoda' && agoda
      ? { ...l, url: agodaRouteUrl(agoda, AGODA_DEFAULT_CID, q), dates: true, copyName: false }
      : l,
  );

  return (
    <div className="flex flex-col gap-5">
      <ReportsSection
        state={
          arranged
            ? { status: 'ready', same: arranged.same, other: arranged.other }
            : { status: reports.status === 'ready' ? 'loading' : reports.status }
        }
        today={today}
        label={(r) => siteLabel(r.site, r.route)}
        onDelete={(r) => void remove(r)}
      />
      <section aria-label={t('lodgingPrice.agodaTitle')} className="flex flex-col gap-2">
        <h3 className="text-body-1 font-semibold">{t('lodgingPrice.agodaTitle')}</h3>
        {/* 자동으로 찾은 숙소 — 다른 후보가 있으면 고를 수 있다 */}
        {found && found.candidates.length > 0 && agoda && 'hid' in agoda && (
          <div className="flex flex-col gap-1.5 rounded-card bg-bg-subtle px-3 py-2">
            <p className="text-caption text-fg-sub">
              {t('lodgingPrice.found', {
                name: found.candidates.find((c) => c.hid === agoda.hid)?.name ?? '',
              })}
            </p>
            {found.candidates.length > 1 && (
              <ScrollRow
                role="radiogroup"
                aria-label={t('lodgingPrice.foundOther')}
                className="flex gap-2 pb-1"
              >
                {found.candidates.map((c) => (
                  <Chip
                    key={c.hid}
                    role="radio"
                    aria-checked={c.hid === agoda.hid}
                    selected={c.hid === agoda.hid}
                    disabled={reports.status === 'loading'}
                    onClick={() => onPick(c)}
                  >
                    <span className="max-w-48 truncate">{c.name}</span>
                  </Chip>
                ))}
              </ScrollRow>
            )}
          </div>
        )}
        {found?.failed && (
          <p
            role="status"
            className="rounded-card bg-warning/10 px-3 py-2 text-caption whitespace-pre-line text-fg-sub"
          >
            {t(`lodgingPrice.lookupFail.${found.failed}`)}
          </p>
        )}
        {agoda ? (
          <>
            <p className="text-caption whitespace-pre-line text-fg-muted">
              {t('lodgingPrice.agodaHint')}
            </p>
            {winner && (
              <p className="rounded-card bg-primary-weak px-3 py-2 text-caption font-semibold text-primary">
                {t('lodgingPrice.reports.winner', {
                  route: t(`lodgingPrice.route.${winner as AgodaRouteId}`),
                })}
              </p>
            )}
            <ScrollRow
              role="radiogroup"
              aria-label={t('lodgingPrice.groupLabel')}
              className="flex gap-2 pb-1"
            >
              {GROUPS.map((g) => (
                <Chip
                  key={g}
                  role="radio"
                  aria-checked={group === g}
                  selected={group === g}
                  onClick={() => setGroup(g)}
                >
                  {t(`lodgingPrice.group.${g}`)} <span className="tabular">{count(g)}</span>
                </Chip>
              ))}
            </ScrollRow>
            <ul className="flex flex-col divide-y divide-line rounded-card border border-line px-3">
              {group === 'all' && (
                <LinkRow
                  label={t('lodgingPrice.route.default')}
                  note={recentText('default')}
                  href={agodaRouteUrl(agoda, AGODA_DEFAULT_CID, q)}
                  {...rowProps('route:default', 'agoda', 'default')}
                />
              )}
              {routes.map((r) => (
                <LinkRow
                  key={r.id}
                  label={t(`lodgingPrice.route.${r.id}`)}
                  note={
                    recentText(r.id) ??
                    (r.group === 'card' ? t('lodgingPrice.cardNote') : undefined)
                  }
                  href={agodaRouteUrl(agoda, r.cid, q)}
                  {...rowProps(`route:${r.id}`, 'agoda', r.id)}
                />
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-card bg-bg-subtle px-3 py-3 text-caption whitespace-pre-line text-fg-sub">
            {t('lodgingPrice.agodaNeedLink')}
          </p>
        )}
        <details className="rounded-card border border-line px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-caption font-semibold text-fg-sub">
            {t('lodgingPrice.promoTitle', { n: AGODA_PROMOS.length })}
          </summary>
          <ul className="flex flex-col divide-y divide-line">
            {AGODA_PROMOS.map((slug) => (
              <LinkRow
                key={slug}
                label={t(`lodgingPrice.promo.${slug}`)}
                href={agodaPromoUrl(slug)}
              />
            ))}
          </ul>
        </details>
      </section>

      <section aria-label={t('lodgingPrice.appsTitle')} className="flex flex-col gap-2">
        <h3 className="text-body-1 font-semibold">{t('lodgingPrice.appsTitle')}</h3>
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line px-3">
          {apps.map((l) => (
            <LinkRow
              key={l.app}
              label={t(`lodgingPrice.app.${l.app}`)}
              note={
                l.copyName
                  ? t('lodgingPrice.copyNameNote')
                  : l.dates
                    ? undefined
                    : t('lodgingPrice.noDates')
              }
              href={l.url}
              onOpen={
                l.copyName ? () => void copyText(q.name, t('lodgingPrice.nameCopied')) : undefined
              }
              {...rowProps(`app:${l.app}`, l.app)}
            />
          ))}
        </ul>
      </section>

      <p className="text-caption whitespace-pre-line text-fg-muted">{t('lodgingPrice.footer')}</p>
      <ReportFormSheet
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        target={target}
        stay={q}
        hotel={{ key: query.hotelKey, name: q.name }}
        query={query}
        onSaved={(list) => {
          onReports(list);
          setPrompt(null);
        }}
      />
    </div>
  );
}

/** 링크 한 줄: [열기]는 새 창(앱이 있으면 앱), [링크 복사]는 웹으로 보고 싶을 때 (docs/28 §4.2) */
function LinkRow({
  label,
  note,
  href,
  onOpen,
  onOpened,
  write,
  prompt = false,
}: {
  label: string;
  note?: string | undefined;
  href: string;
  onOpen?: (() => void) | undefined;
  /** 링크를 눌러 나간 것을 기억 (돌아오면 [적기]) */
  onOpened?: (() => void) | undefined;
  /** 가격 적기 — 기록 목록을 받은 뒤에만 */
  write?: (() => void) | undefined;
  prompt?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col py-1">
      <span className="flex min-h-12 items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-2 font-medium">{label}</span>
          {note && <span className="text-micro text-fg-muted">{note}</span>}
        </span>
        <LinkActions
          label={label}
          href={href}
          write={write}
          onOpen={() => {
            onOpen?.();
            onOpened?.();
            countUse('lodgingPrice.open');
          }}
        />
      </span>
      {prompt && write && (
        <span className="mb-1 flex items-center justify-between gap-2 rounded-btn bg-primary-weak px-3 py-1.5">
          <span className="text-caption font-semibold text-primary">
            {t('lodgingPrice.report.prompt')}
          </span>
          <button
            type="button"
            onClick={write}
            className="h-8 shrink-0 rounded-btn bg-primary px-3 text-caption font-semibold text-on-primary"
          >
            {t('lodgingPrice.report.write')}
          </button>
        </span>
      )}
    </li>
  );
}

function LinkActions({
  label,
  href,
  onOpen,
  write,
}: {
  label: string;
  href: string;
  onOpen: () => void;
  write?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('lodgingPrice.openLabel', { name: label })}
        onClick={onOpen}
        className="flex h-10 shrink-0 items-center gap-1 rounded-btn bg-primary-weak px-3 text-caption font-semibold text-primary"
      >
        {t('lodgingPrice.open')}
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
      <button
        type="button"
        aria-label={t('lodgingPrice.copyLabel', { name: label })}
        onClick={() => void copyText(href, t('lodgingPrice.linkCopied'))}
        className="grid size-10 shrink-0 place-items-center rounded-btn text-fg-sub"
      >
        <Copy aria-hidden="true" className="size-4" />
      </button>
      {write && (
        <button
          type="button"
          aria-label={t('lodgingPrice.report.writeLabel', { name: label })}
          onClick={write}
          className="grid size-10 shrink-0 place-items-center rounded-btn text-primary"
        >
          <PencilLine aria-hidden="true" className="size-4" />
        </button>
      )}
    </>
  );
}
