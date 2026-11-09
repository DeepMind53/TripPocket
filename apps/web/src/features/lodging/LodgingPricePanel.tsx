import { Clipboard, Copy, ExternalLink, History } from 'lucide-react';
import { useState } from 'react';
import { loadRecentStays, saveRecentStay, type RecentStay } from '../../data/lodgingRecent';
import {
  AGODA_DEFAULT_CID,
  AGODA_PROMOS,
  AGODA_ROUTES,
  agodaPromoUrl,
  agodaRouteUrl,
  parseAgodaLink,
  type AgodaBase,
  type AgodaRouteGroup,
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
import { Button, Chip, ScrollRow, SegmentedControl, Stepper, toast } from '../../shared/ui';

const inputClass =
  'h-12 w-full min-w-0 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary';

type Group = 'all' | AgodaRouteGroup;
const GROUPS: readonly Group[] = ['all', 'search', 'card', 'airline'];

/**
 * 숙소 최저가 (실험실, docs/28): 숙소 이름·날짜 → 아고다 경로별 링크 + 예약 앱 링크.
 * 가격은 사용자가 눌러서 각 앱에서 본다. 이 단계는 서버 요청이 없다 (링크만 만든다)
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
  } | null>(null);

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

  const search = () => {
    if (error || agodaBad) return;
    const agoda = parseAgodaLink(agodaText);
    setResult({ q: draft, agoda, domestic });
    setRecent(
      saveRecentStay({ ...draft, domestic, ...(agoda ? { agoda: agodaText.trim() } : {}) }),
    );
    countUse('lodgingPrice.search');
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
          <h3 className="flex items-center gap-1 text-caption font-bold text-fg-muted">
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
          search();
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
        {(agodaBad || (error && error !== 'name' && checkIn && checkOut)) && (
          <p role="alert" className="text-caption whitespace-pre-line text-danger">
            {agodaBad ? t('lodgingPrice.errAgoda') : t(`lodgingPrice.err.${error!}`)}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth disabled={!!error || agodaBad}>
          {t('lodgingPrice.search')}
        </Button>
      </form>

      {result && <Results q={result.q} agoda={result.agoda} domestic={result.domestic} />}
    </div>
  );
}

function Results({
  q,
  agoda,
  domestic,
}: {
  q: StayQuery;
  agoda: AgodaBase | null;
  domestic: boolean;
}) {
  const { t } = useTranslation();
  const [group, setGroup] = useState<Group>('all');
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
      <section aria-label={t('lodgingPrice.agodaTitle')} className="flex flex-col gap-2">
        <h3 className="text-body-1 font-bold">{t('lodgingPrice.agodaTitle')}</h3>
        {agoda ? (
          <>
            <p className="text-caption whitespace-pre-line text-fg-muted">
              {t('lodgingPrice.agodaHint')}
            </p>
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
                  href={agodaRouteUrl(agoda, AGODA_DEFAULT_CID, q)}
                />
              )}
              {routes.map((r) => (
                <LinkRow
                  key={r.id}
                  label={t(`lodgingPrice.route.${r.id}`)}
                  note={r.group === 'card' ? t('lodgingPrice.cardNote') : undefined}
                  href={agodaRouteUrl(agoda, r.cid, q)}
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
        <h3 className="text-body-1 font-bold">{t('lodgingPrice.appsTitle')}</h3>
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
            />
          ))}
        </ul>
      </section>

      <p className="text-caption whitespace-pre-line text-fg-muted">{t('lodgingPrice.footer')}</p>
    </div>
  );
}

/** 링크 한 줄: [열기]는 새 창(앱이 있으면 앱), [링크 복사]는 웹으로 보고 싶을 때 (docs/28 §4.2) */
function LinkRow({
  label,
  note,
  href,
  onOpen,
}: {
  label: string;
  note?: string | undefined;
  href: string;
  onOpen?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex min-h-12 items-center gap-2 py-1">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-2 font-medium">{label}</span>
        {note && <span className="text-micro text-fg-muted">{note}</span>}
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('lodgingPrice.openLabel', { name: label })}
        onClick={() => {
          onOpen?.();
          countUse('lodgingPrice.open');
        }}
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
    </li>
  );
}
