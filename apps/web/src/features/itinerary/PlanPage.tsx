import { useSettings } from '../../data/settingsStore';
import { useCanEdit } from '../../data/tripRoles';
import { useTimeText } from '../../shared/hooks/useTimeText';
import {
  dayNumberOf,
  getTripDays,
  getTripStatus,
  todayIn,
  type Booking,
  type ItineraryItem,
  type LocalDate,
  type Trip,
} from '@trippocket/shared';
import {
  ArrowDownWideNarrow,
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Ellipsis,
  Map as MapIcon,
  Plus,
  Footprints,
  Route,
  TriangleAlert,
} from 'lucide-react';
import { currentItemId, dayText, tightGap } from '../../domain/dayTools';
import { timeIn, useMinuteClock } from '../../shared/hooks/useMinuteClock';
import { copyText } from '../../shared/lib/clipboard';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  Fragment,
  useRef,
  type CSSProperties,
} from 'react';
import { placeBookingsInPlan } from '../../data/bookingPlanner';
import { bookingsToPlan } from '../../domain/bookingPlan';
import { useTranslation } from '../../i18n';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useTrip, useTripBookings, useTripItems } from '../../data/hooks';
import {
  bookingRowsForDay,
  lodgingForNight,
  breakfastOn,
  type BookingRow,
  type LodgingNight,
  bookingForItem,
} from '../../domain/lodging';
import type { Destination } from '../../shared/lib/directions';
import { itemRepo } from '../../data/repositories/itemRepo';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { cn } from '../../shared/lib/cn';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { shortestOrder, sortByTimeKeepingUntimed } from '../../domain/schedule';
import {
  BottomSheet,
  Button,
  Chip,
  IconButton,
  snackbar,
  toast,
  Skeleton,
  ScrollRow,
} from '../../shared/ui';
import { DirectionsSheet } from '../common/DirectionsSheet';
import { openDirectionsDirect } from '../common/openDirections';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ItemFormSheet } from './ItemFormSheet';
import { dayColor, KIND_ICON } from './itemKinds';
import { MoveDaySheet } from './MoveDaySheet';
import { BOOKING_ICON } from '../common/bookingKinds';
import { FlightTicket } from '../bookings/BookingCard';
import { isDomesticTrip } from '../../domain/tripPlace';
import { distanceKm, formatDistance, walkMinutes } from '@trippocket/shared';
import { useLab } from '../../data/labsStore';
import { DayWeatherBadge } from '../common/DayWeatherBadge';
import { useTripWeather, type TripDayWeather } from '../common/useTripWeather';

// 드래그 편집은 편집 모드에 들어갈 때만 불러온다 (dnd-kit 포함)
const EditModeList = lazy(() => import('./EditModeList'));
// 지도도 열 때만
const TripMap = lazy(async () => ({ default: (await import('./TripMap')).TripMap }));

/** 화면에 보여줄 날: 'all' | 'wish' | 일차 번호(1부터) */
type DayFilter = 'all' | 'wish' | number;

/**
 * S-10 일정 (목록). 지도는 17단계에서 위쪽에 붙는다.
 * Day 칩은 주소(?day=)에 반영하되 히스토리는 쌓지 않는다.
 */
export function PlanPage() {
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const items = useTripItems(tripId);
  const bookings = useTripBookings(tripId);
  if (!trip || !items || !bookings) return <Skeleton />;
  return <PlanView trip={trip} items={items} bookings={bookings} />;
}

function PlanView({
  trip,
  items,
  bookings,
}: {
  trip: Trip;
  items: ItineraryItem[];
  bookings: Booking[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // 보기 전용으로 공유받은 여행이면 추가·편집·삭제를 숨긴다 (data/tripRoles.ts)
  const canEdit = useCanEdit(trip.id);
  // 예약을 일정표에 처음 한 번 시각에 맞춰 넣는다 — 이후에는 다른 일정처럼 옮기거나 지울 수 있다 (사용자 요청 2026-10-26)
  const unplanned = canEdit ? bookingsToPlan(bookings, items).length : 0;
  useEffect(() => {
    if (unplanned > 0)
      // 실패하면(화면을 벗어나 DB가 닫힘 등) 다음에 일정을 열 때 다시
      placeBookingsInPlan(trip.id, (airport) => t('plan.arriveAt', { airport })).catch(() => {});
  }, [unplanned, trip.id, t]);
  // 일정으로 들어간 예약은 위쪽 예약 줄에서 뺀다 (일정을 지우면 다시 줄로 보인다)
  const linked = new Set(items.map((i) => i.bookingId).filter(Boolean));
  const rowBookings = bookings.filter((b) => !linked.has(b.id));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const days = getTripDays(trip.startDate, trip.endDate);
  const today = todayIn(trip.timezone);
  const dimPast = useSettings((st) => st.dimPastItems);
  const copyDayOn = useLab('copyDay');
  const { time: timeText } = useTimeText();
  // 지도는 누를 때만 (지도 불러오기도 무료 사용량에 포함)
  // 설정 "일정 화면 지도 기본 펼침"
  const [mapOpen, setMapOpen] = useState(() => useSettings.getState().planMapOpen);
  // 지도를 누르면 크게(아래 일정은 하나씩), 꾹 누르면 지도만 전체 화면(뒤로 가기·X로 닫음)
  const [mapLarge, setMapLarge] = useState(false);
  const [mapFull, setMapFull] = useRouteSheet('map-full');
  const [pagerId, setPagerId] = useState<string | null>(null);
  // 펼친 "빈 날 묶음" (전체 보기에서 3일 이상 이어진 빈 날)
  const [openRuns, setOpenRuns] = useState<ReadonlySet<string>>(new Set());
  const dayIndexOf = useCallback((d: LocalDate) => days.indexOf(d), [days]);
  const ongoing = getTripStatus(trip.startDate, trip.endDate, today) === 'ongoing';
  const isDomestic = isDomesticTrip(trip);
  const weather = useTripWeather(trip);

  // 기본: 여행 중이면 오늘, 아니면 전체
  const dayParam = params.get('day');
  const filter: DayFilter =
    dayParam === 'wish'
      ? 'wish'
      : dayParam && Number(dayParam) >= 1 && Number(dayParam) <= days.length
        ? Number(dayParam)
        : dayParam === 'all' || !ongoing
          ? 'all'
          : (dayNumberOf(trip.startDate, trip.endDate, today) ?? 'all');

  const [formOpen, setFormOpen] = useRouteSheet('item-form');
  const [detailOpen, setDetailOpen] = useRouteSheet('item-detail');
  const [dirOpen, setDirOpen] = useRouteSheet('directions');
  const [moveOpen, setMoveOpen] = useRouteSheet('move-day');
  const [editing, setEditing] = useRouteSheet('edit-mode');
  const [dayMenuOpen, setDayMenuOpen] = useRouteSheet('day-menu');
  const [menuDate, setMenuDate] = useState<LocalDate | null>(null);
  const [dirDest, setDirDest] = useState<Destination | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<{ date: LocalDate | null; editing: boolean }>({
    date: null,
    editing: false,
  });

  const selected = items.find((i) => i.id === selectedId);
  const sameDay = selected ? items.filter((i) => i.date === selected.date) : [];
  const position = selected ? sameDay.findIndex((i) => i.id === selected.id) + 1 : 0;
  const selectedDayIndex = selected?.date ? days.indexOf(selected.date) : -1;
  const selectedDayLabel =
    selected?.date && selectedDayIndex >= 0
      ? t('plan.dayHeader', { n: selectedDayIndex + 1, date: formatMonthDay(selected.date) })
      : t('plan.wishlist');

  const sections: Array<{ date: LocalDate | null; index: number }> =
    filter === 'all'
      ? [...days.map((d, i) => ({ date: d, index: i })), { date: null, index: -1 }]
      : filter === 'wish'
        ? [{ date: null, index: -1 }]
        : [{ date: days[filter - 1] as LocalDate, index: filter - 1 }];

  // 지도에 넘기는 일정(날짜 순) · 크게 보기 카드 목록 (날짜 있는 일정만, 그날 안 번호와 색)
  const mapItems = sections.flatMap((s) => items.filter((i) => i.date === s.date));
  const pagerList = sections.flatMap((s) =>
    s.date
      ? items
          .filter((i) => i.date === s.date)
          .map((item, n) => ({
            item,
            n: n + 1,
            color: dayColor(s.index),
            day: t('plan.dayHeader', { n: s.index + 1, date: formatMonthDay(s.date!) }),
          }))
      : [],
  );
  const pagerItem = pagerList.find((p) => p.item.id === pagerId)?.item ?? pagerList[0]?.item;

  /** 일정·예약·숙소가 하나도 없는 날 */
  const isEmptyDay = (d: LocalDate) =>
    !items.some((i) => i.date === d) &&
    bookingRowsForDay(rowBookings, d).length === 0 &&
    !lodgingForNight(bookings, d);

  // 전체 보기: 지금 화면 위쪽에 있는 날의 칩을 테두리로 표시하고 칩 줄을 그 칩으로 (docs/16 C2)
  const chipsRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [seenDay, setInView] = useState<string | null>(null);
  const inView = filter === 'all' ? seenDay : null;
  useEffect(() => {
    if (filter !== 'all' || typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, boolean>();
    const els = [...document.querySelectorAll<HTMLElement>('main [data-day]')];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          visible.set((e.target as HTMLElement).dataset.day!, e.isIntersecting);
        setInView(els.find((el) => visible.get(el.dataset.day!))?.dataset.day ?? null);
      },
      // 위쪽 고정 머리(제목·칩 줄·지도/편집 줄, 켜져 있으면 지도까지) 아래부터 화면 절반까지
      {
        rootMargin: `-${Math.round(stickyRef.current?.getBoundingClientRect().bottom ?? 160)}px 0px -50% 0px`,
      },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [filter, items, bookings, openRuns, mapOpen, editing]);
  useEffect(() => {
    const bar = chipsRef.current;
    const chip = inView ? bar?.querySelector<HTMLElement>(`[data-chip="${inView}"]`) : null;
    if (!bar || !chip) return;
    bar.scrollTo?.({
      left: chip.offsetLeft - (bar.clientWidth - chip.clientWidth) / 2,
      behavior: 'smooth',
    });
  }, [inView]);

  // C5: 하루 보기에서 목록을 옆으로 밀면 이전·다음 날 / C4: 일정을 꾹 누르면 편집 모드 (2026-10-26 정식)
  const touch = useRef<{ x: number; y: number } | null>(null);
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const swallowClick = useRef(false);
  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const gestures = {
    ...(typeof filter === 'number' && !editing && !(mapOpen && mapLarge)
      ? {
          onTouchStart: (e: React.TouchEvent) => {
            const p = e.touches[0]!;
            touch.current = { x: p.clientX, y: p.clientY };
          },
          onTouchEnd: (e: React.TouchEvent) => {
            const s = touch.current;
            touch.current = null;
            const p = e.changedTouches[0];
            if (!s || !p) return;
            const dx = p.clientX - s.x;
            const dy = p.clientY - s.y;
            if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
            const next = filter + (dx < 0 ? 1 : -1);
            if (next >= 1 && next <= days.length) setFilter(next);
          },
        }
      : {}),
    ...(canEdit && !editing
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            if (!(e.target as Element).closest('[data-item-row]')) return;
            cancelPress();
            const timer = window.setTimeout(() => {
              press.current = null;
              swallowClick.current = true;
              navigator.vibrate?.(15);
              setEditing(true);
            }, 500);
            press.current = { x: e.clientX, y: e.clientY, timer };
          },
          onPointerMove: (e: React.PointerEvent) => {
            const p = press.current;
            if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress();
          },
          onPointerUp: cancelPress,
          onPointerCancel: cancelPress,
          onContextMenu: (e: React.MouseEvent) => {
            if ((e.target as Element).closest('[data-item-row]')) e.preventDefault();
          },
          onClickCapture: (e: React.MouseEvent) => {
            if (!swallowClick.current) return;
            swallowClick.current = false;
            e.stopPropagation();
            e.preventDefault();
          },
        }
      : {}),
  };

  function setFilter(next: DayFilter) {
    setParams({ day: String(next) }, { replace: true });
  }

  function openAdd(date: LocalDate | null) {
    setFormTarget({ date, editing: false });
    setFormOpen(true);
  }

  function openDetail(item: ItineraryItem) {
    setSelectedId(item.id);
    setDetailOpen(true);
  }

  async function remove(item: ItineraryItem) {
    setDetailOpen(false);
    await itemRepo.softDelete(item.id);
    snackbar(t('detail.deleted'), {
      label: t('common.undo'),
      onAction: () => void itemRepo.restore(item.id),
    });
  }

  async function sortDay(date: LocalDate | null) {
    const dayItems = items.filter((i) => i.date === date);
    setDayMenuOpen(false);
    if (dayItems.filter((i) => i.startTime).length < 2) {
      toast(t('plan.sortNeedsTime'));
      return;
    }
    await itemRepo.reorderDay(trip.id, date, sortByTimeKeepingUntimed(dayItems));
    toast(t('plan.sorted'));
  }

  // 동선 짧게 (docs/20 G6): 시간 없는 장소 순서만 바꿈, 되돌리기 가능
  async function shortenDay(date: LocalDate | null) {
    const dayItems = items.filter((i) => i.date === date);
    setDayMenuOpen(false);
    const r = shortestOrder(dayItems, distanceKm);
    if (!r) {
      toast(t('plan.routeAlreadyShort'));
      return;
    }
    const before = dayItems.map((i) => i.id);
    await itemRepo.reorderDay(trip.id, date, r.ids);
    snackbar(t('plan.routeShortened', { km: formatDistance(r.savedKm) }), {
      label: t('common.undo'),
      onAction: () => void itemRepo.reorderDay(trip.id, date, before),
    });
  }

  const dayTitle = (date: LocalDate | null) => {
    const i = date ? days.indexOf(date) : -1;
    return date
      ? t('plan.dayHeader', { n: i + 1, date: formatMonthDay(date) })
      : t('plan.wishlist');
  };

  async function moveTo(date: LocalDate | null) {
    if (!selected) return;
    const count = items.filter((i) => i.date === date).length;
    await itemRepo.move(selected.id, date, count);
    // 이동 시트와 상세 시트를 함께 닫는다
    void navigate(-2);
    toast(t('move.moved'));
  }

  return (
    <div className="flex flex-col">
      {/* 날짜 칩·지도·편집은 스크롤해도 늘 보이게, 켜 둔 지도도 함께 고정 (사용자 요청 2026-10-26).
          전체 화면 지도는 이 상자 안에서 fixed라 위 머리(z-20)보다 위로 올라오게 상자를 올린다 */}
      <div
        ref={stickyRef}
        className={cn(
          'sticky top-[calc(var(--safe-top)+56px)] bg-bg pb-1',
          mapFull ? 'z-50' : 'z-10',
        )}
      >
        <ScrollRow
          ref={chipsRef}
          role="toolbar"
          aria-label={t('plan.dayChipsLabel')}
          className="flex gap-2 px-5 py-2"
        >
          <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
            {t('plan.all')}
          </Chip>
          {days.map((d, i) => (
            <Chip
              key={d}
              data-chip={d}
              aria-current={inView === d ? 'location' : undefined}
              className={inView === d ? 'border-primary text-primary' : undefined}
              selected={filter === i + 1}
              onClick={() => setFilter(i + 1)}
              leading={
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: dayColor(i) }}
                />
              }
            >
              <span className="tabular">
                {t('plan.dayChip', { n: i + 1, date: d.slice(5).replace('-', '.') })}
              </span>
              {d === today && <span className="sr-only"> · {t('date.today')}</span>}
            </Chip>
          ))}
          <Chip
            data-chip="wish"
            aria-current={inView === 'wish' ? 'location' : undefined}
            className={inView === 'wish' ? 'border-primary text-primary' : undefined}
            selected={filter === 'wish'}
            onClick={() => setFilter('wish')}
          >
            {t('plan.wishlist')}
          </Chip>
        </ScrollRow>

        <div className="flex items-center justify-between gap-2 px-5 pt-1">
          {editing ? (
            <p className="flex-1 text-caption text-fg-muted">{t('plan.editHint')}</p>
          ) : (
            <Chip
              selected={mapOpen}
              leading={<MapIcon aria-hidden="true" className="size-4" />}
              onClick={() => {
                setMapOpen(!mapOpen);
                setMapLarge(false);
              }}
            >
              {t('map.toggle')}
            </Chip>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant={editing ? 'primary' : 'ghost'}
              disabled={items.length === 0 && !editing}
              onClick={() => setEditing(!editing)}
            >
              {editing ? t('plan.editDone') : t('plan.edit')}
            </Button>
          )}
        </div>

        {mapOpen && !editing && (
          <div className="px-5 pt-2">
            <Suspense fallback={<div className="h-60 rounded-2xl bg-bg-subtle" />}>
              <TripMap
                trip={trip}
                items={mapItems}
                dayIndexOf={dayIndexOf}
                // 크게 볼 때 핀을 누르면 아래 카드를 그 일정으로, 작게 볼 때는 바로 상세
                onSelect={(i) => (mapLarge || mapFull ? setPagerId(i.id) : openDetail(i))}
                size={mapFull ? 'full' : mapLarge ? 'large' : 'small'}
                focus={mapLarge || mapFull ? pagerItem : undefined}
                onSizeChange={(next) => {
                  if (next === 'full') setMapFull(true);
                  else if (mapFull) setMapFull(false);
                  else setMapLarge(next === 'large');
                }}
              />
            </Suspense>
          </div>
        )}
      </div>

      <div
        {...gestures}
        className={cn('flex flex-col px-5 pt-2', editing ? 'gap-6' : 'gap-4 pb-4')}
      >
        {/* 막 만든 여행: 무엇부터 할지 (docs/20 U5) */}
        {items.length === 0 && canEdit && !editing && (
          <div className="flex flex-col gap-2 rounded-card bg-bg-subtle p-4">
            <p className="text-body-2 font-semibold">{t('plan.startTitle')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => void navigate(`/trips/${trip.id}/places`)}>
                {t('plan.startPlaces')}
              </Button>
              <Button variant="secondary" onClick={() => void navigate(`/ai?trip=${trip.id}`)}>
                {t('plan.startAi')}
              </Button>
            </div>
          </div>
        )}
        {mapOpen && mapLarge && !editing ? (
          <MapPager
            list={pagerList}
            current={Math.max(
              0,
              pagerList.findIndex((p) => p.item.id === pagerItem?.id),
            )}
            onChange={(i) => setPagerId(pagerList[i]?.item.id ?? null)}
            onOpen={openDetail}
          />
        ) : editing ? (
          <Suspense fallback={null}>
            <EditModeList
              sections={sections.map((s) => ({
                ...s,
                color: s.date ? dayColor(s.index) : 'var(--tp-fg-muted)',
              }))}
              items={items}
            />
          </Suspense>
        ) : (
          // 막 만든 여행(일정이 하나도 없음)은 날마다 한 줄씩 — 묶으면 날짜 구조가 안 보임
          groupEmptyDays(sections, (d) => isEmptyDay(d), filter === 'all' && items.length > 0).map(
            (g) =>
              g.kind === 'empty-run' && !openRuns.has(g.key) ? (
                <EmptyRun
                  key={g.key}
                  from={g.days[0]!}
                  to={g.days[g.days.length - 1]!}
                  onOpen={() => setOpenRuns((s) => new Set(s).add(g.key))}
                />
              ) : (
                g.days.map(({ date, index }) =>
                  filter === 'all' && date && isEmptyDay(date) ? (
                    <EmptyDayRow
                      key={date}
                      date={date}
                      index={index}
                      isToday={date === today}
                      canEdit={canEdit}
                      onAdd={() => openAdd(date)}
                      weather={weather[date]}
                    />
                  ) : (
                    <DaySection
                      key={date ?? 'wish'}
                      date={date}
                      index={index}
                      items={items.filter((i) => i.date === date)}
                      isToday={date === today}
                      timezone={trip.timezone}
                      weather={date ? weather[date] : undefined}
                      isPast={dimPast && date !== null && date < today}
                      lodging={date ? lodgingForNight(bookings, date) : null}
                      breakfast={date ? breakfastOn(bookings, date) : null}
                      bookingRows={date ? bookingRowsForDay(rowBookings, date) : []}
                      bookingById={bookingById}
                      onBooking={() => void navigate(`/trips/${trip.id}/bookings`)}
                      onLodging={(b) => {
                        // 일정표에 들어간 숙소 일정이 있으면 다른 장소처럼 상세 (시간·후기·메모·길찾기)
                        const stay = items.find((i) => i.bookingId === b.id);
                        if (stay) return openDetail(stay);
                        const d = { name: b.title, address: b.details?.address };
                        if (openDirectionsDirect(d)) return;
                        setDirDest(d);
                        setDirOpen(true);
                      }}
                      canEdit={canEdit}
                      onAdd={() => openAdd(date)}
                      onOpen={openDetail}
                      onMenu={() => {
                        setMenuDate(date);
                        setDayMenuOpen(true);
                      }}
                      hideWhenEmpty={filter === 'all' && date === null}
                    />
                  ),
                )
              ),
          )
        )}
      </div>

      <BottomSheet
        open={dayMenuOpen}
        onOpenChange={setDayMenuOpen}
        title={t('plan.dayMenu', { day: dayTitle(menuDate) })}
      >
        {/* 실험실: 그날 일정을 카톡 등에 붙여 넣을 글로 */}
        {copyDayOn && (
          <button
            type="button"
            onClick={() => {
              setDayMenuOpen(false);
              void copyText(
                dayText(
                  dayTitle(menuDate),
                  items.filter((i) => i.date === menuDate),
                  timeText,
                ),
                t('labs.dayCopied'),
              );
            }}
            className="flex w-full items-start gap-3 rounded-btn py-3 text-left"
          >
            <ClipboardCopy aria-hidden="true" className="mt-0.5 size-5 text-fg-sub" />
            <span className="flex flex-col">
              <span className="text-body-1">{t('labs.copyDay')}</span>
              <span className="text-caption text-fg-muted">{t('labs.copyDayDesc')}</span>
            </span>
          </button>
        )}
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => void sortDay(menuDate)}
              className="flex w-full items-start gap-3 rounded-btn py-3 text-left"
            >
              <ArrowDownWideNarrow aria-hidden="true" className="mt-0.5 size-5 text-fg-sub" />
              <span className="flex flex-col">
                <span className="text-body-1">{t('plan.sortByTime')}</span>
                <span className="text-caption text-fg-muted">{t('plan.sortByTimeDesc')}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => void shortenDay(menuDate)}
              className="flex w-full items-start gap-3 rounded-btn py-3 text-left"
            >
              <Route aria-hidden="true" className="mt-0.5 size-5 text-fg-sub" />
              <span className="flex flex-col">
                <span className="text-body-1">{t('plan.shortenRoute')}</span>
                <span className="text-caption text-fg-muted">{t('plan.shortenRouteDesc')}</span>
              </span>
            </button>
          </>
        )}
      </BottomSheet>

      <ItemFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        tripId={trip.id}
        date={formTarget.date}
        item={formTarget.editing ? selected : undefined}
      />
      <ItemDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={selected}
        dayLabel={selectedDayLabel}
        showDone={ongoing}
        mapApp={isDomestic ? 'naver' : 'google'}
        onDirections={() => {
          if (!selected) return;
          const d = {
            name: selected.title,
            address: selected.place?.address,
            coords: selected.place?.coords,
          };
          if (openDirectionsDirect(d)) return;
          setDirDest(d);
          setDirOpen(true);
        }}
        onEdit={() => {
          setFormTarget({ date: selected?.date ?? null, editing: true });
          setFormOpen(true);
        }}
        onMoveDay={() => setMoveOpen(true)}
        onDelete={() => selected && void remove(selected)}
        onToggleDone={(done) => selected && void itemRepo.update(selected.id, { done })}
        tripId={trip.id}
        visited={!!selected?.date && selected.date <= today}
        domestic={isDomestic}
        near={trip.destinations.find((d) => d.coords)?.coords}
        countryCode={
          trip.destinations.find((d) => d.countryCode && d.countryCode !== 'KR')?.countryCode
        }
        onVisitTime={(time) =>
          selected && void itemRepo.update(selected.id, { startTime: time || undefined })
        }
        position={position}
        total={sameDay.length}
        // 같은 날 안에서 한 칸씩 (시트는 열어 둔 채 바로 반영)
        onMoveUp={() => selected && void itemRepo.move(selected.id, selected.date, position - 2)}
        onMoveDown={() => selected && void itemRepo.move(selected.id, selected.date, position)}
        readOnly={!canEdit}
        booking={selected ? bookingForItem(selected, bookings) : undefined}
        onOpenBooking={() => void navigate(`/trips/${trip.id}/bookings`)}
      />
      <DirectionsSheet
        open={dirOpen}
        onOpenChange={setDirOpen}
        destination={dirDest}
        isDomestic={isDomestic}
      />
      <MoveDaySheet
        open={moveOpen}
        onOpenChange={setMoveOpen}
        days={days}
        items={items}
        current={selected?.date}
        onPick={(d) => void moveTo(d)}
      />
    </div>
  );
}

function DaySection({
  date,
  index,
  items,
  isToday,
  isPast,
  canEdit,
  onAdd,
  onOpen,
  onMenu,
  lodging,
  onLodging,
  bookingRows,
  bookingById,
  onBooking,
  hideWhenEmpty,
  weather,
  breakfast,
  timezone,
}: {
  weather?: TripDayWeather | undefined;
  /** 여행지 시간대 — 당일 진행 중인 일정 계산 */
  timezone: string;
  /** 그날 아침 조식이 있는 숙소 */
  breakfast?: Booking | null;
  date: LocalDate | null;
  index: number;
  items: ItineraryItem[];
  isToday: boolean;
  /** 지난 날 (설정에서 켜면 흐리게) */
  isPast: boolean;
  canEdit: boolean;
  onAdd: () => void;
  onOpen: (item: ItineraryItem) => void;
  onMenu: () => void;
  lodging: LodgingNight | null;
  onLodging: (booking: Booking) => void;
  bookingRows: BookingRow[];
  /** 예약에서 넘어온 일정의 원래 예약 (점선 테두리·탑승권 모양) */
  bookingById: ReadonlyMap<string, Booking>;
  onBooking: () => void;
  hideWhenEmpty: boolean;
}) {
  const { t } = useTranslation();
  const legs = useLab('legDistance');
  const tight = useLab('tightGap');
  const progressOn = useLab('dayProgress');
  const copyDayOn = useLab('copyDay');
  // 여행 당일: 현지 시각으로 지금 진행 중인 일정 (1분마다 다시 계산)
  const now = useMinuteClock(isToday);
  const nowTime = isToday ? timeIn(timezone, now) : null;
  const nowId = nowTime ? currentItemId(items, nowTime) : null;
  if (hideWhenEmpty && items.length === 0) return null;
  const done = items.filter((i) => i.done).length;
  const color = date ? dayColor(index) : 'var(--tp-fg-muted)';
  const title = date
    ? t('plan.dayHeader', { n: index + 1, date: formatMonthDay(date) })
    : t('plan.wishlist');

  return (
    <section
      aria-label={title}
      data-day={date ?? 'wish'}
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-line bg-surface',
        isPast && 'opacity-60',
      )}
    >
      {/* 날짜 머리글: 날짜 색 띠 + "1일차" 알약 (일정 번호 색과 같음) */}
      <div
        className="flex min-h-12 items-center gap-2 border-b border-line bg-bg-subtle/60 pr-2 pl-4"
        style={{ boxShadow: `inset 4px 0 0 ${color}` }}
      >
        <h2 aria-label={title} className="tabular flex flex-1 items-center gap-2 py-2">
          {date ? (
            <>
              <span
                className="rounded-full px-2.5 py-0.5 text-caption font-bold text-white"
                style={{ background: color }}
              >
                {t('plan.dayN', { n: index + 1 })}
              </span>
              <span className="text-body-1 font-bold">{formatMonthDay(date)}</span>
            </>
          ) : (
            <span className="text-body-1 font-bold">{title}</span>
          )}
          {isToday && (
            <span className="rounded-full bg-primary-weak px-2 py-0.5 text-micro text-primary">
              {t('date.today')}
            </span>
          )}
        </h2>
        <DayWeatherBadge weather={weather} />
        {((canEdit && items.length > 1) || (copyDayOn && items.length > 0)) && (
          <IconButton
            label={t('plan.dayMenu', { day: title })}
            icon={<Ellipsis />}
            onClick={onMenu}
          />
        )}
      </div>
      {/* 실험실: 여행 중 오늘 일정 진행률 */}
      {progressOn && isToday && items.length > 0 && (
        <div
          className="mx-4 mt-2 flex items-center gap-2"
          aria-label={t('labs.progress', { done, total: items.length })}
        >
          <span
            aria-hidden="true"
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-subtle"
          >
            <span
              className="block h-full rounded-full transition-[width]"
              style={{ width: `${(done / items.length) * 100}%`, background: color }}
            />
          </span>
          <span className="tabular text-micro text-fg-muted" aria-hidden="true">
            {done}/{items.length}
          </span>
        </div>
      )}
      {/* 그날 아침 숙소 조식 (사용자 요청 2026-10-26) */}
      {breakfast && (
        <p className="mx-3 mt-2 flex items-center gap-2 rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
          <span aria-hidden="true">🍳</span>
          {t('plan.breakfast', { name: breakfast.title })}
        </p>
      )}
      {bookingRows.length > 0 && (
        <ul aria-label={t('plan.bookingsLabel')} className="flex flex-col gap-1 px-3 pt-2">
          {bookingRows.map((row) => (
            <BookingLine key={`${row.booking.id}-${row.part}`} row={row} onOpen={onBooking} />
          ))}
        </ul>
      )}
      {items.length === 0 && (
        <p className="px-4 py-3 text-body-2 text-fg-muted">
          {date ? t('plan.emptyDay') : t('plan.wishEmpty')}
        </p>
      )}
      <ol className="flex flex-col gap-1.5 px-3 py-2">
        {items.map((item, i) => (
          <Fragment key={item.id}>
            <ItemRow
              item={item}
              n={i + 1}
              color={color}
              now={item.id === nowId}
              booking={item.bookingId ? bookingById.get(item.bookingId) : undefined}
              onOpen={() => onOpen(item)}
            />
            {legs && <LegLine from={item} to={items[i + 1]} />}
            {tight && <TightLine from={item} to={items[i + 1]} />}
          </Fragment>
        ))}
      </ol>
      {canEdit && (
        <button
          type="button"
          onClick={onAdd}
          className="mx-3 mb-3 flex h-11 items-center justify-center gap-1 rounded-btn border border-dashed border-line text-body-2 font-semibold text-fg-sub"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('plan.addItem')}
        </button>
      )}
      {lodging && (
        <button
          type="button"
          onClick={() => onLodging(lodging.booking)}
          aria-label={t('plan.lodgingLabel', {
            title: lodging.booking.title,
            night: lodging.night,
          })}
          className="mx-3 mb-3 -mt-1 flex items-center gap-2 rounded-btn bg-bg-subtle px-3 py-2.5 text-left"
        >
          <BedDouble aria-hidden="true" className="size-4 shrink-0 text-day-4" />
          <span className="text-caption font-semibold text-fg-sub">{t('plan.lodging')}</span>
          <span className="min-w-0 flex-1 truncate text-body-2 font-medium">
            {lodging.booking.title}
          </span>
          <span className="tabular shrink-0 text-caption text-fg-muted">
            {lodging.night}/{lodging.nights}
          </span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
        </button>
      )}
    </section>
  );
}

function BookingLine({ row, onOpen }: { row: BookingRow; onOpen: () => void }) {
  const { time, wide } = useTimeText();
  const { t } = useTranslation();
  const b = row.booking;
  const Icon = BOOKING_ICON[b.kind];
  const route =
    (b.kind === 'flight' || b.kind === 'transfer') && (b.start.place || b.end?.place)
      ? `${b.start.place ?? ''} → ${b.end?.place ?? ''}`
      : null;
  // 출발하는 날의 항공편은 예약 탭과 같은 탑승권으로 (편명·공항·시각·터미널·좌석·예약번호)
  if (b.kind === 'flight' && row.part === 'start')
    return (
      <li>
        <button
          type="button"
          onClick={onOpen}
          aria-label={t('plan.openBooking', { title: b.title })}
          className="flex w-full flex-col gap-2 rounded-btn border border-dashed border-line px-3 py-3 text-left"
        >
          <FlightTicket booking={b} />
          {b.confirmationNo && (
            <span className="tabular border-t border-dashed border-line pt-1.5 text-caption text-fg-sub">
              {t('bookings.confirmationNo')}{' '}
              <strong className="font-bold text-fg">{b.confirmationNo}</strong>
            </span>
          )}
        </button>
      </li>
    );
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('plan.openBooking', { title: b.title })}
        className="flex w-full items-center gap-3 rounded-btn border border-dashed border-line px-2 py-2 text-left"
      >
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-weak text-primary"
        >
          <Icon className="size-3.5" />
        </span>
        <span className={cn('tabular shrink-0 text-caption text-fg-sub', wide ? 'w-16' : 'w-11')}>
          {time(row.time) ?? '—'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-2 font-medium">
            {row.part === 'arrive' && `${t('plan.arrive')} · `}
            {b.title}
          </span>
          {(route || b.confirmationNo) && (
            <span className="tabular truncate text-caption text-fg-muted">
              {[route, b.confirmationNo].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <span className="shrink-0 rounded-md bg-bg-subtle px-1.5 py-0.5 text-micro text-fg-sub">
          {t(`bookingKind.${b.kind}`)}
        </span>
      </button>
    </li>
  );
}

/** 실험실 "빠듯한 일정 알림": 걸어서 걸리는 시간이 두 일정 시각 차이보다 길 때 */
function TightLine({ from, to }: { from: ItineraryItem; to: ItineraryItem | undefined }) {
  const { t } = useTranslation();
  const r = tightGap(from, to);
  if (!r) return null;
  return (
    <li className="flex items-center gap-1.5 py-1 pl-9 text-micro font-semibold text-warning">
      <TriangleAlert aria-hidden="true" className="size-3" />
      {t('labs.tight', { walk: r.walk, gap: r.gap })}
    </li>
  );
}

/** 실험실 "다음 장소까지 거리": 두 일정 모두 좌표가 있을 때만 직선거리·도보 어림 */
function LegLine({ from, to }: { from: ItineraryItem; to: ItineraryItem | undefined }) {
  const { t } = useTranslation();
  const a = from.place?.coords;
  const b = to?.place?.coords;
  if (!a || !b) return null;
  const km = distanceKm(a, b);
  return (
    <li className="flex items-center gap-1.5 py-1 pl-9 text-micro text-fg-muted">
      <Footprints aria-hidden="true" className="size-3" />
      {t('labs.leg', { distance: formatDistance(km), min: walkMinutes(km) })}
    </li>
  );
}

function ItemRow({
  item,
  n,
  color,
  now,
  booking,
  onOpen,
}: {
  item: ItineraryItem;
  n: number;
  color: string;
  /** 여행 당일 지금 진행 중: 진한 테두리·굵은 글자·바탕 깜빡임 (사용자 요청 2026-10-26) */
  now: boolean;
  /** 예약에서 넘어온 일정이면 그 예약: 점선 테두리로 구분 (사용자 요청 2026-10-26) */
  booking?: Booking | undefined;
  onOpen: () => void;
}) {
  const { time, wide } = useTimeText();
  const { t } = useTranslation();
  const Icon = KIND_ICON[item.kind];
  const label = t('plan.itemLabel', {
    n,
    title: item.kind === 'note' ? (item.memo ?? item.title) : item.title,
  });
  const badge = (
    <span
      aria-hidden="true"
      className="tabular grid size-6 shrink-0 place-items-center rounded-full text-micro font-bold text-white"
      style={{ background: color }}
    >
      {item.done ? <Check className="size-3.5" /> : n}
    </span>
  );
  // 종류마다 아주 연한 파스텔 바탕 (styles/index.css .kind-tint)
  const kindStyle = { '--kind': `var(--tp-kind-${item.kind})` } as CSSProperties;
  // 항공편 출발 일정은 예약 탭과 같은 탑승권 모양 그대로 (도착 공항 일정은 아래 보통 줄)
  if (booking?.kind === 'flight' && item.transport)
    return (
      <li>
        <button
          type="button"
          data-item-row=""
          data-from-booking=""
          onClick={onOpen}
          aria-label={label}
          aria-current={now ? 'time' : undefined}
          style={kindStyle}
          className={cn(
            'kind-tint flex w-full items-start gap-3 rounded-btn border border-dashed border-fg-muted/60 px-2 py-3 text-left active:bg-bg-subtle',
            item.done && 'opacity-50',
            now && 'kind-now border-transparent font-bold',
          )}
        >
          {badge}
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <FlightTicket booking={booking} />
            {booking.confirmationNo && (
              <span className="tabular border-t border-dashed border-line pt-1.5 text-caption text-fg-sub">
                {t('bookings.confirmationNo')}{' '}
                <strong className="font-bold text-fg">{booking.confirmationNo}</strong>
              </span>
            )}
          </span>
        </button>
      </li>
    );
  return (
    <li>
      <button
        type="button"
        data-item-row=""
        {...(booking ? { 'data-from-booking': '' } : {})}
        onClick={onOpen}
        aria-label={label}
        aria-current={now ? 'time' : undefined}
        style={kindStyle}
        className={cn(
          'kind-tint flex w-full items-start gap-3 rounded-btn px-2 py-3 text-left active:bg-bg-subtle',
          booking && 'border border-dashed border-fg-muted/60',
          now && 'kind-now border-transparent',
        )}
      >
        {/* 번호·시간·종류는 제목 첫 줄 높이(24px)에 가운데 맞춤 */}
        {badge}
        <span
          className={cn(
            'tabular shrink-0 text-caption leading-6 font-semibold text-fg-sub',
            wide ? 'w-16' : 'w-11',
          )}
        >
          {time(item.startTime) ?? <span className="text-fg-muted/60">--:--</span>}
        </span>
        <span className={cn('flex min-w-0 flex-1 flex-col', item.done && 'opacity-50')}>
          {item.kind === 'note' ? (
            <span
              className={cn(
                'line-clamp-4 text-body-2',
                item.done && 'line-through',
                now && 'font-bold',
              )}
            >
              {item.memo ?? item.title}
            </span>
          ) : (
            <span className={cn('text-body-1', item.done && 'line-through', now && 'font-bold')}>
              {item.title}
            </span>
          )}
          {item.transport && (item.transport.from || item.transport.to) && (
            <span className="tabular truncate text-caption text-fg-muted">
              {item.transport.from ?? ''} → {item.transport.to ?? ''}
            </span>
          )}
          {item.kind !== 'note' && item.place?.address && (
            <span className="truncate text-caption text-fg-muted">{item.place.address}</span>
          )}
        </span>
        <span className="flex h-6 shrink-0 items-center gap-1 rounded-md bg-bg-subtle px-1.5 text-micro text-fg-sub">
          <Icon aria-hidden="true" className="size-3" />
          {t(`kind.${item.kind}`)}
        </span>
      </button>
    </li>
  );
}

/** 지도를 크게 볼 때 아래 일정은 한 개씩: 좌우로 넘기거나 ‹ › (넘기면 지도가 그 핀으로) */
function MapPager({
  list,
  current,
  onChange,
  onOpen,
}: {
  list: { item: ItineraryItem; n: number; color: string; day: string }[];
  current: number;
  onChange: (index: number) => void;
  onOpen: (item: ItineraryItem) => void;
}) {
  const { t } = useTranslation();
  const startX = useRef<number | null>(null);
  const entry = list[current];
  if (!entry)
    return <p className="py-6 text-center text-body-2 text-fg-muted">{t('map.pagerEmpty')}</p>;
  const go = (d: number) => onChange(Math.min(list.length - 1, Math.max(0, current + d)));
  return (
    <section
      aria-label={t('map.pagerLabel')}
      className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3"
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = startX.current === null ? 0 : e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center gap-1">
        <IconButton
          label={t('map.prev')}
          icon={<ChevronLeft />}
          disabled={current === 0}
          onClick={() => go(-1)}
        />
        <p className="flex-1 text-center text-caption font-semibold text-fg-sub" aria-live="polite">
          {entry.day} ·{' '}
          <span className="tabular">
            {t('map.pagerPos', { n: current + 1, total: list.length })}
          </span>
        </p>
        <IconButton
          label={t('map.next')}
          icon={<ChevronRight />}
          disabled={current >= list.length - 1}
          onClick={() => go(1)}
        />
      </div>
      <ol>
        <ItemRow
          item={entry.item}
          n={entry.n}
          color={entry.color}
          now={false}
          onOpen={() => onOpen(entry.item)}
        />
      </ol>
    </section>
  );
}

type Section = { date: LocalDate | null; index: number };
type Group = { kind: 'days' | 'empty-run'; key: string; days: Section[] };

/** 전체 보기: 이어진 빈 날이 3일 이상이면 한 묶음으로 (하루 보기·가고 싶은 곳은 그대로) */
function groupEmptyDays(
  sections: readonly Section[],
  isEmpty: (d: LocalDate) => boolean,
  allView: boolean,
): Group[] {
  const out: Group[] = [];
  let run: Section[] = [];
  const flush = () => {
    if (run.length >= 3) out.push({ kind: 'empty-run', key: run[0]!.date!, days: run });
    else if (run.length) out.push({ kind: 'days', key: run[0]!.date!, days: run });
    run = [];
  };
  for (const s of sections) {
    if (allView && s.date && isEmpty(s.date)) {
      run.push(s);
      continue;
    }
    flush();
    out.push({ kind: 'days', key: s.date ?? 'wish', days: [s] });
  }
  flush();
  return out;
}

/** 빈 날 한 줄: "3일차 10.29 (목) · 일정 없음  [+ 추가]" (docs/16 C1) */
function EmptyDayRow({
  date,
  index,
  isToday,
  canEdit,
  onAdd,
  weather,
}: {
  date: LocalDate;
  index: number;
  isToday: boolean;
  canEdit: boolean;
  onAdd: () => void;
  weather?: TripDayWeather | undefined;
}) {
  const { t } = useTranslation();
  const color = dayColor(index);
  const title = t('plan.dayHeader', { n: index + 1, date: formatMonthDay(date) });
  return (
    <section
      aria-label={title}
      data-day={date}
      className="flex min-h-12 items-center gap-2 rounded-2xl border border-dashed border-line pr-1 pl-4"
    >
      <h2 aria-label={title} className="tabular flex flex-1 items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-caption font-bold text-white"
          style={{ background: color }}
        >
          {t('plan.dayN', { n: index + 1 })}
        </span>
        <span className="text-body-2 font-semibold">{formatMonthDay(date)}</span>
        {isToday && (
          <span className="rounded-full bg-primary-weak px-2 py-0.5 text-micro text-primary">
            {t('date.today')}
          </span>
        )}
        <span className="text-caption text-fg-muted">· {t('plan.noItems')}</span>
      </h2>
      <DayWeatherBadge weather={weather} />
      {canEdit && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onAdd}
          aria-label={t('plan.addItemTo', { day: title })}
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('plan.addShort')}
        </Button>
      )}
    </section>
  );
}

/** 이어진 빈 날 묶음: "3~5일차 일정 없음" — 누르면 펼침 */
function EmptyRun({ from, to, onOpen }: { from: Section; to: Section; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      data-day={from.date!}
      className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-dashed border-line px-4 text-left"
    >
      <span className="tabular text-body-2 font-semibold">
        {t('plan.emptyRun', {
          from: from.index + 1,
          to: to.index + 1,
          range: `${formatMonthDay(from.date!)} – ${formatMonthDay(to.date!)}`,
        })}
      </span>
      <span className="text-caption text-primary">{t('plan.showDays')}</span>
    </button>
  );
}
