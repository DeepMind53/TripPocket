import { useSettings } from '../../data/settingsStore';
import { TravelModeGate } from '../travel/TravelModeGate';
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
  SAVED_PLACES_MAX,
} from '@trippocket/shared';
import {
  ArrowDownWideNarrow,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  ClipboardCopy,
  ClipboardPaste,
  Clock4,
  CopyPlus,
  Map as MapIcon,
  MapPinned,
  Route,
} from 'lucide-react';
import { dayText, nextStop, visitableItemIds } from '../../domain/dayTools';
import { NextStopBar } from './NextStopBar';
import { earlierVisits, type Visit } from '../../domain/visit';
import { applyVisit } from '../../data/skippedToSaved';
import { timeIn, useMinuteClock } from '../../shared/hooks/useMinuteClock';
import { useLab } from '../../data/labsStore';
import { icsText } from '../../domain/labTools';
import { saveFile } from '../backup/backupUtils';
import { BulkAddSheet } from '../labs/BulkAddSheet';
import { ShiftDaySheet } from '../labs/ShiftDaySheet';
import { copyText } from '../../shared/lib/clipboard';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useRef,
  type CSSProperties,
} from 'react';
import { placeBookingsInPlan } from '../../data/bookingPlanner';
import { bookingsToPlan } from '../../domain/bookingPlan';
import { useTranslation } from '../../i18n';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  useTrip,
  useTripBookings,
  useTripItems,
  useTrips,
  useVisitedItems,
} from '../../data/hooks';
import {
  bookingRowsForDay,
  lodgingForNight,
  breakfastOn,
  bookingForItem,
} from '../../domain/lodging';
import type { Destination } from '../../shared/lib/directions';
import { itemRepo } from '../../data/repositories/itemRepo';
import { useRouteSheet, useSheetArg } from '../../shared/hooks/useRouteSheet';
import { useStoredFlag } from '../../shared/hooks/useStoredFlag';
import { cn } from '../../shared/lib/cn';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { shortestOrder, sortByTimeKeepingUntimed } from '../../domain/schedule';
import { mapViewOf, resizeMap, toggleMapBase, type MapBase } from '../../domain/mapView';
import {
  BottomSheet,
  Button,
  Chip,
  IconButton,
  snackbar,
  toast,
  Skeleton,
  ScrollRow,
  RollingSlot,
  routeStyle,
} from '../../shared/ui';
import { DirectionsSheet } from '../common/DirectionsSheet';
import { openDirectionsDirect } from '../common/openDirections';
import { DuplicateDaySheet } from './DuplicateDaySheet';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ItemFormSheet } from './ItemFormSheet';
import { dayColor } from './itemKinds';
import { MoveDaySheet } from './MoveDaySheet';
import { isDomesticTrip } from '../../domain/tripPlace';
import { dayRouteUrl } from '../../domain/dayRoute';
import { sunTimes } from '../../domain/sun';
import { checkoutsOn } from '../../domain/dayExtras';
import { useTripHolidays } from './useTripHolidays';
import { DayPlanSheet } from './DayPlanSheet';
import { usePlanView } from './usePlanView';
import { distanceKm, formatDistance } from '@trippocket/shared';
import { useTripWeather } from '../common/useTripWeather';
import { confirmDelete } from '../../shared/ui';
import { DaySection } from './DaySection';
import { MapPager } from './MapPager';
import { groupEmptyDays } from './planSections';
import { EmptyDayRow } from './EmptyDayRow';
import { EmptyRun } from './EmptyRun';

// 드래그 편집은 편집 모드에 들어갈 때만 불러온다 (dnd-kit 포함)
const EditModeList = lazy(() => import('./EditModeList'));
// 지도도 열 때만
const TripMap = lazy(async () => ({ default: (await import('./TripMap')).TripMap }));
// 실험실 "여행 전체 노선도" — 누를 때만
const TripRouteSheet = lazy(async () => ({
  default: (await import('./TripRouteSheet')).TripRouteSheet,
}));

/** 화면에 보여줄 날: 'all' | 'wish' | 일차 번호(1부터) */
type DayFilter = 'all' | 'wish' | number;

/**
 * S-10 일정 (목록). 지도는 17단계에서 위쪽에 붙는다.
 * Day 칩은 주소(?day=)에 반영하되 히스토리는 쌓지 않는다.
 */
/** 일정 상세에서 보던 일정 id (이 탭에만, sessionStorage) */
const SELECTED_KEY = 'tp-plan-selected';

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
  items: allItems,
  bookings,
}: {
  trip: Trip;
  items: ItineraryItem[];
  bookings: Booking[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const days = getTripDays(trip.startDate, trip.endDate);
  // 현지 공휴일 (설정 "일정" — 2026-10-28 실험실에서 정식) · Plan B "현지 공휴일" 조건에도
  const localHolidayOn = useSettings((st) => st.localHoliday);
  const holidays = useTripHolidays(trip, localHolidayOn);
  const weather = useTripWeather(trip);
  // Plan B (실험실, 2026-11-03): 날짜마다 보일 플랜의 일정만 — 아래 화면은 모두 이 목록을 쓴다
  const plansView = usePlanView(trip, allItems, days, weather, holidays);
  const items = plansView.visible;
  const planDate = useSheetArg<LocalDate | null>(['day-plan']) ?? null;
  const [planOpen, setPlanOpen] = useRouteSheet('day-plan');
  // 보기 전용으로 공유받은 여행이면 추가·편집·삭제를 숨긴다 (data/tripRoles.ts)
  const canEdit = useCanEdit(trip.id);
  // 예약을 일정표에 처음 한 번 시각에 맞춰 넣는다 — 이후에는 다른 일정처럼 옮기거나 지울 수 있다 (사용자 요청 2026-10-26)
  const unplanned = canEdit ? bookingsToPlan(bookings, allItems).length : 0;
  useEffect(() => {
    if (unplanned > 0)
      // 실패하면(화면을 벗어나 DB가 닫힘 등) 다음에 일정을 열 때 다시
      placeBookingsInPlan(trip.id, (airport) => t('plan.arriveAt', { airport })).catch(() => {});
  }, [unplanned, trip.id, t]);
  // 일정으로 들어간 예약은 위쪽 예약 줄에서 뺀다 (일정을 지우면 다시 줄로 보인다)
  const linked = new Set(allItems.map((i) => i.bookingId).filter(Boolean));
  const rowBookings = bookings.filter((b) => !linked.has(b.id));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const today = todayIn(trip.timezone);
  // 실험실 "하루 한 줄 기록" (2026-11-10)
  const dayNoteOn = useSettings((st) => st.dayNote);
  // 설정 "노선도" (2026-11-10): 일차 머리 미니맵을 누르면 여행 전체 노선도
  const [routeOpen, setRouteOpen] = useState(false);
  const dimPast = useSettings((st) => st.dimPastItems);
  // 2026-10-27 정식: 하루 일정 글로 복사·하루 동선 지도 (날짜 메뉴)
  const copyDayOn = true;
  const dayRouteOn = true;
  // 설정 "일정 사이 일출·일몰"(목적지 좌표로 계산)
  const sunOn = useSettings((st) => st.sunTimes);
  // 하루 마지막 일정 → 숙소까지 거리 (일정표에 들어간 숙소 좌표, 2026-10-27 정식)
  const lodgingReturnOn = true;
  const coordsOfBooking = (id: string | undefined) =>
    id ? items.find((i) => i.bookingId === id && i.place?.coords)?.place?.coords : undefined;
  const sunCoords = trip.destinations.find((d) => d.coords)?.coords;
  // 날짜 없는 가고 싶은 곳 (실험실 "근처 가고 싶은 곳")
  const wishItems = items.filter((i) => i.date === null);
  const { time: timeText } = useTimeText();
  // 지도는 누를 때만 (지도 불러오기도 무료 사용량에 포함)
  // 설정 "일정 화면 지도 기본 펼침"
  // 지도를 누르면 크게(아래 일정은 하나씩), 꾹 누르면 지도만 전체 화면(뒤로 가기·X로 닫음) — 상태 규칙은 domain/mapView
  const [mapBase, setMapBase] = useState<MapBase>(() =>
    useSettings.getState().planMapOpen ? 'small' : 'closed',
  );
  const [mapFull, setMapFull] = useRouteSheet('map-full');
  const [pagerId, setPagerId] = useState<string | null>(null);
  // 펼친 "빈 날 묶음" (전체 보기에서 3일 이상 이어진 빈 날)
  const [openRuns, setOpenRuns] = useState<ReadonlySet<string>>(new Set());
  const dayIndexOf = useCallback((d: LocalDate) => days.indexOf(d), [days]);
  const ongoing = getTripStatus(trip.startDate, trip.endDate, today) === 'ongoing';
  // 설정 "지금 일정으로 이동": 여행 중 일정 화면을 열면 진행 중 일정(없으면 오늘 칸)으로 한 번 스크롤
  const nowScroll = useSettings((st) => st.nowScroll);
  useEffect(() => {
    if (!nowScroll || !ongoing) return;
    const id = window.setTimeout(() => {
      const el =
        document.querySelector<HTMLElement>('main [aria-current="time"]') ??
        document.querySelector<HTMLElement>(`main [data-day="${today}"]`);
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 300);
    return () => window.clearTimeout(id);
  }, [nowScroll, ongoing]); // eslint-disable-line react-hooks/exhaustive-deps -- 화면을 열 때 한 번
  // 여행 당일 지금 시각 (1분마다) — "다음 일정" 줄
  const clock = useMinuteClock(ongoing);
  const nowTime = ongoing ? timeIn(trip.timezone, clock) : null;
  const nextStopItem = nowTime
    ? nextStop(
        items.filter((i) => i.date === today),
        nowTime,
      )
    : null;
  const isDomestic = isDomesticTrip(trip);

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
  const mapView = mapViewOf(mapBase, mapFull, editing);
  const [dayMenuOpen, setDayMenuOpen, switchDayMenuTo] = useRouteSheet('day-menu');
  // 방문 기록: 예전에 같은 장소를 방문한 날(다른 여행 포함), 미방문은 저장 탭으로 (사용자 요청 2026-10-27)
  const visitedAll = useVisitedItems() ?? [];
  const tripTitles = new Map((useTrips() ?? []).map((tr) => [tr.id, tr.title]));
  const historyOf = (item: ItineraryItem) =>
    earlierVisits(item, visitedAll).map((v) => ({
      date: v.date!,
      trip: tripTitles.get(v.tripId) ?? '',
    }));
  async function markVisit(item: ItineraryItem, visit: Visit | null) {
    const r = await applyVisit(item, visit, trip);
    if (r === 'saved') toast(t('visit.savedToSaved'));
    else if (r === 'limit') toast(t('saved.limit', { max: SAVED_PLACES_MAX }));
  }
  const [dupOpen, setDupOpen] = useRouteSheet('dup-day');
  const dupOn = true;
  // 날짜 메뉴와 거기서 넘어가는 시트(복제·붙여 넣기·시간 밀기)는 같은 날을 대상으로
  const menuDate =
    useSheetArg<LocalDate | null>(['day-menu', 'dup-day', 'bulk-add', 'shift-day']) ?? null;
  // 실험실 (2026-11-13 3차): 여러 일정 붙여 넣기 · 남은 일정 미루기 · 캘린더로 내보내기
  const bulkOn = useLab('bulkAdd');
  const shiftOn = useLab('shiftDay');
  const icsOn = useLab('calendarExport');
  const [bulkOpen, setBulkOpen] = useRouteSheet('bulk-add');
  const [shiftOpen, setShiftOpen] = useRouteSheet('shift-day');
  const dirDest = useSheetArg<Destination>(['directions']) ?? null;
  // 고른 일정은 이 탭에 기억한다 — 상세 시트는 새로고침(앱 다시 열기)해도 다시 열리는데,
  // 무엇을 보던 중인지 모르면 빈 시트가 일정을 가렸다 (2026-10-28, 아이폰 오프라인 확인 중 발견)
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  });
  const setSelectedId = (id: string | null) => {
    setSelectedIdState(id);
    try {
      if (id) sessionStorage.setItem(SELECTED_KEY, id);
      else sessionStorage.removeItem(SELECTED_KEY);
    } catch {
      // 기억 못 해도 이번 화면에서는 그대로
    }
  };
  // 일정 입력 시트 대상: 어느 날에 추가 / 어떤 일정을 고침 (시트와 함께 브라우저 기록에)
  const formTarget = useSheetArg<{ date: LocalDate | null; itemId?: string }>(['item-form']) ?? {
    date: null,
  };

  const selected = items.find((i) => i.id === selectedId);
  // 다시 열었는데 보던 일정이 없으면(지워짐·다른 여행) 빈 상세 시트를 닫는다
  useEffect(() => {
    if (detailOpen && !selected) setDetailOpen(false);
  }, [detailOpen, selected]); // eslint-disable-line react-hooks/exhaustive-deps -- 열림·고른 일정이 바뀔 때만
  const sameDay = selected ? items.filter((i) => i.date === selected.date) : [];
  // 상세에서 방문 기록을 고칠 수 있는 일정 — 일정표와 같은 규칙 (여행지 지금 시각 기준)
  const selectedPast =
    !!selected &&
    visitableItemIds(sameDay, today, timeIn(trip.timezone, new Date()) ?? '00:00').has(selected.id);
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
            dayIndex: s.index,
            day: t('plan.dayHeader', { n: s.index + 1, date: formatMonthDay(s.date!) }),
          }))
      : [],
  );
  const pagerItem = pagerList.find((p) => p.item.id === pagerId)?.item ?? pagerList[0]?.item;

  /** 일정·예약·숙소가 하나도 없는 날 */
  const isEmptyDay = (d: LocalDate) =>
    // 다른 플랜에만 일정이 있는 날도 날짜 칸을 보여 준다 (플랜을 고를 수 있게)
    !allItems.some((i) => i.date === d) &&
    bookingRowsForDay(rowBookings, d).length === 0 &&
    !lodgingForNight(bookings, d);

  // 전체 보기: 지금 화면 위쪽에 있는 날의 칩을 테두리로 표시하고 칩 줄을 그 칩으로 (docs/16 C2)
  const chipsRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  // 날짜 칩 줄·지도/편집 줄 접기 (사용자 요청 2026-11-17) — 이 기기에 기억. 편집 중에는 늘 펼침([완료] 버튼)
  const [toolsFolded, setToolsFolded] = useStoredFlag('tp-plan-tools-folded', false);
  const folded = toolsFolded && !editing;
  // 접었을 때 펴기 버튼은 날짜 머리 오른쪽에. 날짜 머리가 하나도 없는 화면(빈 여행 전체 보기·지도 크게)만 위에 얇은 줄로
  const headerUnfold = folded && mapBase !== 'large' && (items.length > 0 || filter !== 'all');
  // 위 고정 영역(칩 줄·지도/편집 줄·펼친 지도) 높이 — 날짜 머리가 그 바로 아래에 붙는다 (사용자 요청 2026-10-27)
  const [stickyH, setStickyH] = useState(0);
  useEffect(() => {
    const el = stickyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // 고정 영역의 실제 고정 위치(top) + 높이 = 날짜 머리가 붙을 자리 (화면마다 위 여백이 달라 직접 잰다)
    const measure = () =>
      setStickyH(Math.round((parseFloat(getComputedStyle(el).top) || 0) + el.offsetHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
  }, [filter, items, bookings, openRuns, mapBase, editing, folded]);
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
    ...(typeof filter === 'number' && !editing && mapBase !== 'large'
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
    setFormOpen(true, { date });
  }

  function openDetail(item: ItineraryItem) {
    setSelectedId(item.id);
    setDetailOpen(true);
  }

  async function remove(item: ItineraryItem) {
    if (!(await confirmDelete(t('confirm.item', { name: item.title })))) return;
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
      <TravelModeGate trip={trip} />
      {/* 날짜 칩·지도·편집은 스크롤해도 늘 보이게, 켜 둔 지도도 함께 고정 (사용자 요청 2026-10-26).
          전체 화면 지도는 이 상자 안에서 fixed라 위 머리(z-20)보다 위로 올라오게 상자를 올린다 */}
      <div
        ref={stickyRef}
        data-plan-sticky=""
        className={cn(
          'sticky top-[var(--topbar-h,calc(var(--safe-top)+56px))] bg-bg',
          mapView === 'full' ? 'z-50' : 'z-10',
        )}
      >
        {/* 접으면 이 줄은 높이 0 — 펴기 버튼은 날짜 머리 오른쪽에 (빈 공간 최소화, 사용자 요청 2026-11-17) */}
        {folded ? (
          headerUnfold ? null : (
            <div className="flex justify-end pr-2">
              <IconButton
                label={t('plan.toolsUnfold')}
                icon={<ChevronDown />}
                aria-expanded={false}
                onClick={() => setToolsFolded(false)}
              />
            </div>
          )
        ) : (
          <>
            <div className="flex items-center">
              <ScrollRow
                ref={chipsRef}
                role="toolbar"
                aria-label={t('plan.dayChipsLabel')}
                outerClassName="min-w-0 flex-1"
                // 위아래 여백 6px로 두 줄 간격을 맞춘다 (사용자 요청 2026-11-18)
                className="flex gap-1.5 py-1.5 pl-5"
              >
                <Chip size="sm" selected={filter === 'all'} onClick={() => setFilter('all')}>
                  {t('plan.all')}
                </Chip>
                {days.map((d, i) => (
                  <Chip
                    size="sm"
                    key={d}
                    data-chip={d}
                    aria-current={inView === d ? 'location' : undefined}
                    // 노선 색 알약 (docs/29 §4.3): 고르면 진한 노선 색 채움, 아니면 노선 색 테두리. 버튼 구조·이름은 그대로
                    style={routeStyle(i)}
                    className={
                      filter === i + 1
                        ? 'border-transparent! bg-[var(--route-ink)]! text-on-primary!'
                        : inView === d
                          ? 'border-primary text-primary'
                          : 'border-[var(--route)]! text-[var(--route-ink)]!'
                    }
                    selected={filter === i + 1}
                    onClick={() => setFilter(i + 1)}
                    // 글자가 번갈아 바뀌어도 이름은 그대로 "N일차 11.17 (화)" (+ 오늘)
                    aria-label={
                      t('plan.dayChip', { n: i + 1, date: formatMonthDay(d) }) +
                      (d === today ? ` · ${t('date.today')}` : '')
                    }
                    leading={
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{
                          background: filter === i + 1 ? 'var(--tp-on-primary)' : dayColor(i),
                        }}
                      />
                    }
                  >
                    {/* "N일차"와 날짜를 번갈아 — 아래 날짜 머리줄과 같은 글자 (사용자 요청 2026-11-18).
                        칩 폭은 날짜(더 긴 쪽)에 맞춰 고정: 보이지 않는 날짜 글자로 자리를 잡고 그 위에서 굴린다 */}
                    <span aria-hidden="true" className="tabular relative inline-grid">
                      <span className="invisible">{formatMonthDay(d)}</span>
                      <RollingSlot
                        className="absolute! inset-0 h-full! justify-center"
                        items={[
                          <span key="day">{t('plan.dayN', { n: i + 1 })}</span>,
                          <span key="date">{formatMonthDay(d)}</span>,
                        ]}
                      />
                    </span>
                  </Chip>
                ))}
                <Chip
                  size="sm"
                  data-chip="wish"
                  aria-current={inView === 'wish' ? 'location' : undefined}
                  className={inView === 'wish' ? 'border-primary text-primary' : undefined}
                  selected={filter === 'wish'}
                  onClick={() => setFilter('wish')}
                >
                  {t('plan.wishlist')}
                </Chip>
              </ScrollRow>
              {!editing && (
                <IconButton
                  label={t('plan.toolsFold')}
                  icon={<ChevronUp />}
                  aria-expanded={true}
                  // 칩 줄 높이(40)를 넘지 않게 — 너비 44는 그대로
                  className="mr-2 h-10! shrink-0"
                  onClick={() => setToolsFolded(true)}
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-5 tight:flex-wrap">
              {editing ? (
                <p className="flex-1 text-caption text-fg-muted">{t('plan.editHint')}</p>
              ) : (
                <Chip
                  size="sm"
                  selected={mapBase !== 'closed'}
                  leading={<MapIcon aria-hidden="true" className="size-3.5" />}
                  onClick={() => setMapBase(toggleMapBase(mapBase))}
                >
                  {t('map.toggle')}
                </Chip>
              )}
              {routeOpen && (
                <Suspense fallback={null}>
                  <TripRouteSheet
                    open={routeOpen}
                    onOpenChange={setRouteOpen}
                    days={days.map((d, index) => ({
                      index,
                      date: formatMonthDay(d),
                      stops: items
                        .filter((i) => i.date === d && i.kind !== 'note')
                        .map((i) => i.title),
                    }))}
                  />
                </Suspense>
              )}
              {/* 여행 당일: 지금 위치에서 다음 일정까지 (사용자 요청 2026-10-27) */}
              {!editing && nextStopItem && nowTime && (
                <div className="flex min-w-0 flex-1 justify-center tight:order-last tight:basis-full">
                  <NextStopBar next={nextStopItem} now={nowTime} />
                </div>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  // 지도 칩과 같은 높이 28 (너비는 넉넉해 누르기 쉬움)
                  className="h-7!"
                  variant={editing ? 'primary' : 'ghost'}
                  disabled={items.length === 0 && !editing}
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? t('plan.editDone') : t('plan.edit')}
                </Button>
              )}
            </div>
          </>
        )}

        {mapView !== 'closed' && (
          <div className="px-5 pt-2">
            <Suspense fallback={<div className="h-60 rounded-2xl bg-bg-subtle" />}>
              <TripMap
                trip={trip}
                items={mapItems}
                dayIndexOf={dayIndexOf}
                // 크게 볼 때 핀을 누르면 아래 카드를 그 일정으로, 작게 볼 때는 바로 상세
                onSelect={(i) => (mapView === 'small' ? openDetail(i) : setPagerId(i.id))}
                size={mapView}
                focus={mapView === 'small' ? undefined : pagerItem}
                onSizeChange={(next) => {
                  const step = resizeMap(mapView, next);
                  if (step.kind === 'openFull') setMapFull(true);
                  else if (step.kind === 'closeFull') setMapFull(false);
                  else setMapBase(step.base);
                }}
              />
            </Suspense>
          </div>
        )}
      </div>

      <div
        {...gestures}
        className={cn('flex flex-col px-5', editing ? 'gap-6' : 'gap-6 pb-4')}
        style={{ '--day-top': `${stickyH}px` } as CSSProperties}
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
        {mapBase === 'large' && !editing ? (
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
                      onVisitItem={(item, v) => void markVisit(item, v)}
                      historyOf={historyOf}
                      weather={date ? weather[date] : undefined}
                      sun={
                        sunOn && date && sunCoords ? sunTimes(date, sunCoords, trip.timezone) : null
                      }
                      isPast={dimPast && date !== null && date < today}
                      lodging={date ? lodgingForNight(bookings, date) : null}
                      wishes={date ? wishItems : undefined}
                      checkouts={date ? checkoutsOn(bookings, date) : undefined}
                      holiday={date ? holidays[date] : undefined}
                      lodgingCoords={
                        lodgingReturnOn && date
                          ? coordsOfBooking(lodgingForNight(bookings, date)?.booking.id)
                          : undefined
                      }
                      breakfast={date ? breakfastOn(bookings, date) : null}
                      bookingRows={date ? bookingRowsForDay(rowBookings, date) : []}
                      bookingById={bookingById}
                      onBooking={() => void navigate(`/trips/${trip.id}/bookings`)}
                      onLodging={(b) => {
                        // 일정표에 들어간 숙소 일정이 있으면 다른 장소처럼 상세 (시간·후기·메모·길찾기)
                        const stay = items.find((i) => i.bookingId === b.id);
                        if (stay) return openDetail(stay);
                        const d = { name: b.title, address: b.details?.address };
                        if (openDirectionsDirect(d, isDomestic)) return;
                        setDirOpen(true, d);
                      }}
                      canEdit={canEdit}
                      onAdd={() => openAdd(date)}
                      onOpen={openDetail}
                      onMenu={() => {
                        setDayMenuOpen(true, date);
                      }}
                      plan={date && plansView.on ? plansView.info[date] : undefined}
                      onPlans={
                        date && plansView.on
                          ? () => {
                              setPlanOpen(true, date);
                            }
                          : undefined
                      }
                      hideWhenEmpty={filter === 'all' && date === null}
                      onRouteMap={() => setRouteOpen(true)}
                      onUnfold={headerUnfold ? () => setToolsFolded(false) : undefined}
                      noteTrip={dayNoteOn && canEdit && date && date <= today ? trip : undefined}
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
        {/* 그날 일정을 카톡 등에 붙여 넣을 글로 */}
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
        {/* 그날 장소를 순서대로 Google 지도 길찾기로 (키 없는 공식 URL, 항공 구간 빼고) */}
        {dayRouteOn && dayRouteUrl(items.filter((i) => i.date === menuDate)) && (
          <a
            href={dayRouteUrl(items.filter((i) => i.date === menuDate))!}
            target="_blank"
            rel="noreferrer"
            onClick={() => setDayMenuOpen(false)}
            className="flex w-full items-start gap-3 rounded-btn py-3 text-left"
          >
            <MapPinned aria-hidden="true" className="mt-0.5 size-5 text-fg-sub" />
            <span className="flex flex-col">
              <span className="text-body-1">{t('labs.dayRoute')}</span>
              <span className="text-caption text-fg-muted">{t('labs.dayRouteDesc')}</span>
            </span>
          </a>
        )}
        {/* 실험실: 그날 일정을 다른 날·다른 여행으로 복제 */}
        {dupOn && canEdit && items.some((i) => i.date === menuDate) && (
          <button
            type="button"
            onClick={() => switchDayMenuTo('dup-day')}
            className="flex w-full items-start gap-3 rounded-btn py-3 text-left"
          >
            <CopyPlus aria-hidden="true" className="mt-0.5 size-5 text-fg-sub" />
            <span className="flex flex-col">
              <span className="text-body-1">{t('duplicate.title')}</span>
              <span className="text-caption text-fg-muted">{t('duplicate.desc')}</span>
            </span>
          </button>
        )}
        {bulkOn && canEdit && menuDate && (
          <button
            type="button"
            onClick={() => switchDayMenuTo('bulk-add')}
            className="flex w-full items-start gap-3 rounded-btn py-3 text-left"
          >
            <ClipboardPaste aria-hidden="true" className="mt-0.5 size-5 text-fg-sub" />
            <span className="flex flex-col">
              <span className="text-body-1">{t('tool.bulkTitle')}</span>
              <span className="text-caption text-fg-muted">{t('tool.bulkMenuDesc')}</span>
            </span>
          </button>
        )}
        {shiftOn && canEdit && items.some((i) => i.date === menuDate && i.startTime) && (
          <button
            type="button"
            onClick={() => switchDayMenuTo('shift-day')}
            className="flex w-full items-start gap-3 rounded-btn py-3 text-left"
          >
            <Clock4 aria-hidden="true" className="mt-0.5 size-5 text-fg-sub" />
            <span className="flex flex-col">
              <span className="text-body-1">{t('tool.shiftTitle')}</span>
              <span className="text-caption text-fg-muted">{t('tool.shiftMenuDesc')}</span>
            </span>
          </button>
        )}
        {icsOn && items.some((i) => i.date && i.kind !== 'note') && (
          <button
            type="button"
            onClick={() => {
              setDayMenuOpen(false);
              void saveFile(
                `${trip.title}.ics`,
                icsText(trip, items, new Date()),
                trip.title,
                'text/calendar',
              );
            }}
            className="flex w-full items-start gap-3 rounded-btn py-3 text-left"
          >
            <CalendarPlus aria-hidden="true" className="mt-0.5 size-5 text-fg-sub" />
            <span className="flex flex-col">
              <span className="text-body-1">{t('tool.icsTitle')}</span>
              <span className="text-caption text-fg-muted">{t('tool.icsDesc')}</span>
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

      {bulkOpen && menuDate && (
        <BulkAddSheet open={bulkOpen} onOpenChange={setBulkOpen} tripId={trip.id} date={menuDate} />
      )}
      {shiftOpen && menuDate && (
        <ShiftDaySheet
          open={shiftOpen}
          onOpenChange={setShiftOpen}
          items={items.filter((i) => i.date === menuDate)}
          now={menuDate === today ? (timeIn(trip.timezone, new Date()) ?? undefined) : undefined}
        />
      )}
      {dupOpen && (
        <DuplicateDaySheet
          open={dupOpen}
          onOpenChange={setDupOpen}
          trip={trip}
          from={menuDate}
          items={items.filter((i) => i.date === menuDate)}
        />
      )}

      <ItemFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        tripId={trip.id}
        date={formTarget.date}
        item={formTarget.itemId ? items.find((i) => i.id === formTarget.itemId) : undefined}
        planId={formTarget.date ? plansView.info[formTarget.date]?.plan?.id : undefined}
      />
      {plansView.on && (
        <DayPlanSheet
          open={planOpen}
          onOpenChange={setPlanOpen}
          trip={trip}
          date={planDate}
          title={dayTitle(planDate)}
          info={planDate ? plansView.info[planDate] : undefined}
          canEdit={canEdit}
        />
      )}
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
          if (openDirectionsDirect(d, isDomestic)) return;
          setDirOpen(true, d);
        }}
        onEdit={() => {
          if (selected) setFormOpen(true, { date: selected.date, itemId: selected.id });
        }}
        onMoveDay={() => setMoveOpen(true)}
        onDelete={() => selected && void remove(selected)}
        onToggleDone={(done) => selected && void itemRepo.update(selected.id, { done })}
        onVisit={
          selected && canEdit && selectedPast ? (v) => void markVisit(selected, v) : undefined
        }
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
