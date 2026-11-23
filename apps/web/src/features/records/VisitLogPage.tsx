import {
  dayNumberOf,
  flagEmoji,
  ITEM_KINDS,
  type ItemKind,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';
import { MapPinned, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTrips, useVisitedItems } from '../../data/hooks';
import {
  groupByCity,
  groupByPlace,
  groupByTrip,
  matchesVisit,
  visitCity,
} from '../../domain/visitLog';
import { useTranslation } from '../../i18n';
import { formatMonthDay, formatPeriod } from '../../shared/lib/dateFormat';
import { useRouteSheet, useSheetArg } from '../../shared/hooks/useRouteSheet';
import {
  Button,
  Chip,
  EmptyState,
  ScrollRow,
  SegmentedControl,
  TopBar,
  routeColor,
} from '../../shared/ui';
import { VisitGroup } from './VisitGroup';
import { VisitItemSheet } from './VisitItemSheet';
import { VisitRow } from './VisitRow';

type View = 'trip' | 'city' | 'place';
type Filter = 'all' | 'visited' | 'skipped' | ItemKind;
const VIEWS: readonly View[] = ['trip', 'city', 'place'];

const isView = (v: string | null): v is View => VIEWS.includes(v as View);
const isFilter = (v: string | null): v is Filter =>
  v === 'all' || v === 'visited' || v === 'skipped' || ITEM_KINDS.includes(v as ItemKind);

/**
 * 기록 → 방문 기록 전체 (사용자 결정 2026-11-24, docs/32): 여행별·도시별·장소별 보기, 검색(초성), 방문·종류 고르기.
 * 보기·검색·고르기는 주소(?view=&q=&f=)에 남겨 뒤로 와도 그대로. 줄을 누르면 상세 시트
 */
export function VisitLogPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const view: View = isView(params.get('view')) ? (params.get('view') as View) : 'trip';
  const filter: Filter = isFilter(params.get('f')) ? (params.get('f') as Filter) : 'all';
  const q = params.get('q') ?? '';
  const setParam = (key: string, value: string | null) =>
    setParams(
      (cur) => {
        const next = new URLSearchParams(cur);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const all = useVisitedItems();
  const tripList = useTrips();
  const trips = useMemo(() => new Map((tripList ?? []).map((tr) => [tr.id, tr])), [tripList]);
  const kinds = ITEM_KINDS.filter((k) => (all ?? []).some((i) => i.kind === k));
  const items = (all ?? []).filter(
    (i) =>
      (filter === 'all' || i.visit === filter || i.kind === filter) &&
      matchesVisit(q, i, trips.get(i.tripId), visitCity(i, trips.get(i.tripId))),
  );

  // 펼친 묶음 (보기마다 따로) — 처음엔 요약에서 누른 여행(?trip=), 없으면 맨 위 하나. 검색 중에는 모두 펼침
  const [opened, setOpened] = useState<Partial<Record<View, ReadonlySet<string>>>>(() => {
    const trip = params.get('trip');
    return trip ? { trip: new Set([`trip:${trip}`]) } : {};
  });
  const isOpen = (key: string, first: string) =>
    q.trim() !== '' || (opened[view] ?? new Set([first])).has(key);
  const toggle = (key: string, first: string) =>
    setOpened((cur) => {
      const next = new Set(cur[view] ?? [first]);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...cur, [view]: next };
    });

  const [sheetOpen, setSheetOpen] = useRouteSheet('visit-item');
  const sheetId = useSheetArg<string>(['visit-item']);
  const sheetItem = (all ?? []).find((i) => i.id === sheetId);
  const openItem = (i: ItineraryItem) => setSheetOpen(true, i.id);

  const tripName = (tr: Trip | undefined) => {
    const c = tr?.destinations.find((d) => d.countryCode)?.countryCode;
    return `${c ? `${flagEmoji(c)} ` : ''}${tr?.title ?? ''}`;
  };
  const dateTrip = (i: ItineraryItem) =>
    [i.date ? formatMonthDay(i.date) : null, trips.get(i.tripId)?.title]
      .filter(Boolean)
      .join(' · ');
  const list = (rows: readonly ItineraryItem[], sub?: (i: ItineraryItem) => string) => (
    <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
      {rows.map((i) => (
        <VisitRow key={i.id} item={i} sub={sub?.(i)} onOpen={() => openItem(i)} />
      ))}
    </ul>
  );

  const visited = items.filter((i) => i.visit === 'visited').length;

  return (
    <>
      <TopBar title={t('visit.logTitle')} backTo="/records" />
      <div className="flex flex-col gap-3 px-5 pt-2 pb-8">
        <label className="flex h-12 items-center gap-2 rounded-btn bg-bg-subtle px-3">
          <Search aria-hidden="true" className="size-[18px] shrink-0 text-fg-muted" />
          <input
            type="search"
            aria-label={t('visit.searchLabel')}
            placeholder={t('visit.searchPlaceholder')}
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-body-1 outline-none"
          />
        </label>
        <SegmentedControl
          label={t('visit.viewLabel')}
          // 세 글자 셋이라 좁은 화면에서도 한 줄 (기본은 세로로 쌓임)
          className="tight:grid-flow-col!"
          value={view}
          onChange={(v) => setParam('view', v === 'trip' ? null : v)}
          options={VIEWS.map((v) => ({ value: v, label: t(`visit.view.${v}`) }))}
        />
        <ScrollRow role="group" aria-label={t('visit.filterLabel')} className="flex gap-2 pb-1">
          {(['all', 'visited', 'skipped', ...kinds] as const).map((f) => (
            <Chip
              key={f}
              size="sm"
              selected={filter === f}
              onClick={() => setParam('f', f === 'all' || filter === f ? null : f)}
            >
              {f === 'all'
                ? t('visit.filterAll')
                : f === 'visited' || f === 'skipped'
                  ? t(`visit.button.${f}`)
                  : t(`kind.${f}`)}
            </Chip>
          ))}
        </ScrollRow>

        {all && items.length > 0 && (
          <p className="tabular text-caption text-fg-sub">
            {t('visit.logCounts', { visited, skipped: items.length - visited })}
          </p>
        )}

        {all && all.length === 0 && (
          <p className="text-body-2 whitespace-pre-line text-fg-muted">{t('visit.logEmpty')}</p>
        )}
        {all && all.length > 0 && items.length === 0 && (
          <EmptyState
            icon={MapPinned}
            title={t('visit.noResult')}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setParams(
                    (cur) => {
                      const next = new URLSearchParams(cur);
                      next.delete('q');
                      next.delete('f');
                      return next;
                    },
                    { replace: true },
                  )
                }
              >
                {t('visit.clearSearch')}
              </Button>
            }
          />
        )}

        {view === 'trip' &&
          groupByTrip(items, trips).map((g, _i, arr) => {
            const first = `trip:${arr[0]!.tripId}`;
            const key = `trip:${g.tripId}`;
            const total = g.days.reduce((n, d) => n + d.items.length, 0);
            return (
              <VisitGroup
                key={key}
                label={g.trip?.title ?? ''}
                title={tripName(g.trip)}
                sub={g.trip ? formatPeriod(g.trip.startDate, g.trip.endDate) : undefined}
                meta={t('visit.tripCount', { visited: g.visited, total })}
                open={isOpen(key, first)}
                onToggle={() => toggle(key, first)}
              >
                <div className="flex flex-col gap-3 pb-2">
                  {g.days.map((d) => {
                    const n =
                      d.date && g.trip
                        ? dayNumberOf(g.trip.startDate, g.trip.endDate, d.date)
                        : null;
                    return (
                      <div key={d.date ?? 'none'} className="flex flex-col gap-1.5">
                        {d.date && (
                          <h3 className="tabular flex items-center gap-1.5 text-caption text-fg-sub">
                            {n !== null && (
                              <span
                                aria-hidden="true"
                                className="size-2 shrink-0 rounded-full"
                                style={{ background: routeColor(n - 1).line }}
                              />
                            )}
                            {formatMonthDay(d.date)}
                            {n !== null && (
                              <span className="text-fg-muted">{t('plan.dayN', { n })}</span>
                            )}
                          </h3>
                        )}
                        {list(d.items)}
                      </div>
                    );
                  })}
                </div>
              </VisitGroup>
            );
          })}

        {view === 'city' &&
          groupByCity(items, trips).map((g, _i, arr) => {
            const first = `city:${arr[0]!.city?.key ?? ''}`;
            const key = `city:${g.city?.key ?? ''}`;
            const name = g.city?.name ?? t('visit.otherCity');
            const flag = g.city?.countryCode ? `${flagEmoji(g.city.countryCode)} ` : '';
            return (
              <VisitGroup
                key={key}
                label={name}
                title={`${flag}${name}`}
                meta={t('visit.cityMeta', { visited: g.visited, trips: g.tripCount })}
                open={isOpen(key, first)}
                onToggle={() => toggle(key, first)}
              >
                <div className="pb-2">{list(g.items, dateTrip)}</div>
              </VisitGroup>
            );
          })}

        {view === 'place' &&
          groupByPlace(items).map((g, _i, arr) => {
            const first = `place:${arr[0]!.head.id}`;
            const key = `place:${g.head.id}`;
            const city = visitCity(g.head, trips.get(g.head.tripId));
            return (
              <VisitGroup
                key={key}
                label={g.head.title}
                title={g.head.title}
                sub={city?.name}
                meta={
                  g.visited > 0
                    ? t('visit.placeTimes', { n: g.visited })
                    : t('visit.button.skipped')
                }
                open={isOpen(key, first)}
                onToggle={() => toggle(key, first)}
              >
                <div className="pb-2">{list(g.items, dateTrip)}</div>
              </VisitGroup>
            );
          })}
      </div>
      <VisitItemSheet
        item={sheetItem}
        trip={sheetItem ? trips.get(sheetItem.tripId) : undefined}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
