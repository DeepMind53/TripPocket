import { useSettings } from '../../data/settingsStore';
import { InlineIcon } from '../../shared/ui/InlineIcon';
import {
  todayIn,
  type Booking,
  type ItineraryItem,
  type LocalDate,
  type Trip,
} from '@trippocket/shared';
import {
  BedDouble,
  ChevronDown,
  ChevronRight,
  Droplets,
  EggFried,
  Ellipsis,
  Haze,
  Luggage,
  MoonStar,
  Mountain,
  Plus,
  Route,
  Shirt,
  SunMedium,
  TreePalm,
} from 'lucide-react';
import { currentItemId, pastItemIds, visitableItemIds, FAR_LEG_KM } from '../../domain/dayTools';
import { DayMiniMap } from './DayMiniMap';
import { type Visit } from '../../domain/visit';
import { flightSignature, flightsToReconfirm } from '../../domain/flightCheck';
import { confirmFlight, useFlightChecks } from '../../data/flightCheckStore';
import { timeIn, useMinuteClock } from '../../shared/hooks/useMinuteClock';
import { useLab } from '../../data/labsStore';
import { useState, Fragment, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { type BookingRow, type LodgingNight } from '../../domain/lodging';
import { cn } from '../../shared/lib/cn';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import {
  IconButton,
  routeColor,
  routeStyle,
  ROUTE_LINE_CLASS,
  useRouteLine,
} from '../../shared/ui';
import { sunSlot } from '../../domain/sun';
import { dayRecap, nearbyWishes } from '../../domain/dayExtras';
import { lateNightAt } from '../../domain/travelExtras';
import { airWarnings } from '../../domain/air';
import { placeTips } from '../../domain/localInfo';
import { weatherCautionsAt } from '../../domain/weather';
import { DayNoteField } from './DayNoteField';
import { ShorterOrderHint } from './ShorterOrderHint';
import { type DayPlanInfo } from './usePlanView';
import { distanceKm, formatDistance, walkMinutes } from '@trippocket/shared';
import { DayWeatherBadge } from '../common/DayWeatherBadge';
import { type TripDayWeather } from '../common/useTripWeather';
import { RollingSlot } from '../../shared/ui';
import { BookingLine } from './BookingLine';
import { LegLine } from './LegLine';
import { ItemRow } from './ItemRow';
import { SunLine } from './SunLine';

/** 장소 맞춤 팁 앞 아이콘 (2026-11-04 이모지 → 선 아이콘) */
const PLACE_TIP_ICON = {
  dress: Shirt,
  onsen: Droplets,
  beach: TreePalm,
  hike: Mountain,
} as const;

export function DaySection({
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
  onVisitItem,
  historyOf,
  sun,
  lodgingCoords,
  wishes,
  checkouts,
  holiday,
  plan,
  onPlans,
  noteTrip,
  onRouteMap,
  onUnfold,
}: {
  /** 설정 "노선도": 미니맵을 누르면 여행 전체 노선도 */
  onRouteMap: () => void;
  /** 위 날짜·지도 줄을 접었으면: 날짜 머리 오른쪽 끝의 펴기 버튼 */
  onUnfold?: (() => void) | undefined;
  /** 실험실 "하루 한 줄 기록": 오늘·지난 날이면 그 여행 (아니면 칸 없음) */
  noteTrip?: Trip | undefined;
  /** Plan B (실험실): 그날 플랜 정보 · 날짜 머리글을 누르면 플랜 시트 */
  plan?: DayPlanInfo | undefined;
  onPlans?: (() => void) | undefined;
  /** 지난 일정 방문·미방문 (미방문이면 저장 탭에도 담는다) */
  onVisitItem: (item: ItineraryItem, visit: Visit | null) => void;
  /** 이 일정 장소를 예전에 방문한 날 */
  historyOf: (item: ItineraryItem) => { date: string; trip: string }[];
  weather?: TripDayWeather | undefined;
  /** 실험실 "근처 가고 싶은 곳": 날짜 없는 가고 싶은 곳 */
  wishes?: ItineraryItem[] | undefined;
  /** 현지 공휴일 이름 (설정 "일정") */
  holiday?: string | undefined;
  /** 실험실 "오늘 체크아웃": 그날 체크아웃하는 숙소 */
  checkouts?: { title: string; time?: string | undefined }[] | undefined;
  /** 그날 밤 숙소 좌표 (마지막 장소 → 숙소 거리) */
  lodgingCoords?: { lat: number; lng: number } | undefined;
  /** 일출·일몰 (현지 시각) — 일정 사이 시간 순서 자리에 한 줄씩 */
  sun?: { rise: string; set: string } | null;
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
  // 설정 "일정" (2026-10-27 실험실에서 정식)
  const legs = useSettings((st) => st.legDistance);
  // 실험실 "일정 사이 빈 시간" (2026-11-13)
  // 2026-10-27 정식: 하루 일정 글로 복사·하루 동선 지도
  const copyDayOn = true;
  const dayRouteOn = true;
  const compact = useSettings((st) => st.compactList);
  // 설정 "일정" (2026-10-27 실험실에서 정식)
  const nearbyOn = useSettings((st) => st.nearbyWish);
  const checkoutOn = useSettings((st) => st.checkoutNotice);
  const recapOn = useSettings((st) => st.dayRecap);
  // 날씨 주의 (2026-10-28 실험실에서 정식, 설정 "일정")
  const weatherOn = useSettings((st) => st.weatherMark);
  // 늦은 귀가 안내 (설정 "일정" — 2026-10-28 실험실에서 정식)
  const lateOn = useSettings((st) => st.lateNight);
  // 실험실 (2026-11-03): 장소 맞춤 팁
  const tipsOn = useSettings((st) => st.placeTips);
  const dupOn = true;
  const bulkOn = useLab('bulkAdd');
  // 여행 당일: 현지 시각으로 지금 진행 중인 일정 (1분마다 다시 계산)
  const now = useMinuteClock(isToday);
  const nowTime = isToday ? timeIn(timezone, now) : null;
  const nowId = nowTime ? currentItemId(items, nowTime) : null;
  // 실험실 "방문 기록": 지난 일정에 [방문][미방문] (보기 전용이면 없음)
  const visitOn = canEdit;
  // 출발 전날~출발 날 항공편은 [확인]을 누를 때까지 빨갛게 (이 기기 기록)
  const flightChecks = useFlightChecks();
  const recheck = new Set(
    flightsToReconfirm([...bookingById.values()], todayIn(timezone), flightChecks).map((b) => b.id),
  );
  const today = todayIn(timezone);
  const past = visitOn ? pastItemIds(items, today, timeIn(timezone, now) ?? '00:00') : null;
  // 방문·미방문 버튼: 지난 일정 + 지금 진행 중인 일정과 그 앞 일정 (사용자 요청 2026-11-17)
  const visitable = visitOn
    ? visitableItemIds(items, today, timeIn(timezone, now) ?? '00:00')
    : null;
  const miniMapOn = useSettings((st) => st.routeMap);
  // 여행 중 오늘: 지난 일정은 여행 모드처럼 접어 둔다 — [지난 일정 N]으로 펼침 (사용자 요청 2026-11-10)
  const [pastOpen, setPastOpen] = useState(false);
  const todayPast = isToday ? pastItemIds(items, today, timeIn(timezone, now) ?? '00:00') : null;
  const folded = todayPast && !pastOpen ? todayPast : null;
  // 그날 노선 선 위치를 실제 번호 원 가운데로 맞춘다 (2026-11-10)
  const routeRef = useRef<HTMLOListElement | null>(null);
  useRouteLine(routeRef);
  if (hideWhenEmpty && items.length === 0) return null;
  // 오늘 진행률 (2026-10-27 정식): 메모는 빼고, 방문(파랑)·미방문(빨강)을 칸에 채운다
  const tracked = items.filter((i) => i.kind !== 'note');
  const nearby = nearbyOn && wishes ? nearbyWishes(items, wishes) : [];
  const outs = checkoutOn ? (checkouts ?? []) : [];
  const recap = recapOn && date && date <= todayIn(timezone) ? dayRecap(items) : null;
  // 날씨 주의: 예보(작년 기록 아님)가 있는 날만, 일정 시각마다 시간별 예보로 (2026-10-28)
  const forecast = weatherOn && date && weather && !weather.year ? weather : null;
  const lateAt = lateOn && date ? lateNightAt(items) : null;
  const tips = tipsOn && date ? placeTips(items) : [];
  // 그날 마지막 장소 → 숙소 (직선거리)
  const lastCoords = [...tracked].reverse().find((i) => i.place?.coords)?.place?.coords;
  const visited = tracked.filter((i) => i.visit === 'visited' || i.done).length;
  const skipped = tracked.filter((i) => i.visit === 'skipped').length;
  // 일차 알약은 진한 노선 색 + on-primary 글자 (8색 모두 4.5:1, docs/29 §3.1)
  const dayInk = routeColor(index).ink;
  // "N일차" 알약과 날짜를 한 칸에서 3초마다 번갈아 — 날씨·오늘 칸처럼 (사용자 요청 2026-11-18).
  // 폭은 날짜에 맞춰 두어 바뀔 때 옆 노선도 버튼이 움직이지 않게
  const dayRoll = date ? (
    <RollingSlot
      className="min-w-[5.5rem]"
      items={[
        <span
          key="day"
          className="rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap text-on-primary"
          style={{ background: dayInk }}
        >
          {t('plan.dayN', { n: index + 1 })}
        </span>,
        <span key="date" className="text-body-1 font-semibold whitespace-nowrap">
          {formatMonthDay(date)}
        </span>,
      ]}
    />
  ) : null;
  const title = date
    ? t('plan.dayHeader', { n: index + 1, date: formatMonthDay(date) })
    : t('plan.wishlist');

  return (
    <section
      aria-label={title}
      data-day={date ?? 'wish'}
      className={cn('flex flex-col', isPast && 'opacity-60')}
    >
      {/* 날짜 머리글: "1일차" 알약(일정 번호 색과 같음) + 날짜, 아래 선 (unslop 2026-11-09 카드 상자 → 평평한 목록).
          그날 일정이 보이는 동안 화면 위(고정 영역 아래)에 붙어 있고, 다음 날로 넘어가면 다음 날 머리로 바뀐다 (2026-10-27) */}
      <div className="sticky top-[var(--day-top,0px)] z-[5] -mx-5 bg-bg/95 px-5 backdrop-blur">
        <div className="flex min-h-12 items-center gap-2 border-b border-line">
          <h2 aria-label={title} className="tabular flex min-w-0 flex-wrap items-center gap-2 py-2">
            {date && onPlans ? (
              // Plan B (실험실): 날짜를 누르면 플랜 고르기·만들기
              <button
                type="button"
                onClick={onPlans}
                aria-label={t('planB.open', { day: title })}
                className="flex min-h-9 items-center gap-2"
              >
                {dayRoll}
                <ChevronDown aria-hidden="true" className="size-4 text-fg-muted" />
              </button>
            ) : date ? (
              dayRoll
            ) : (
              <span className="text-body-1 font-semibold">{title}</span>
            )}
          </h2>
          {/* 설정 "노선도" (2026-11-10): 그날 동선 미니맵 — 누르면 여행 전체 노선도. 좌표가 모자라면 노선 아이콘 */}
          {miniMapOn && date && (
            <button
              type="button"
              onClick={onRouteMap}
              aria-label={t('routeMap.openAll')}
              style={routeStyle(index)}
              className="grid min-h-11 min-w-11 place-items-center"
            >
              <DayMiniMap
                items={items}
                fallback={<Route aria-hidden="true" className="size-5 text-[var(--route-ink)]" />}
              />
            </button>
          )}
          {/* 노선도 버튼은 날짜 바로 옆, 나머지는 오른쪽 끝으로 (사용자 요청 2026-11-10) */}
          <span aria-hidden="true" className="flex-1" />
          {/* 날씨·오늘·Plan B를 한 칸에서 3초마다 번갈아 (날짜 아래 줄에 쌓이지 않게, 사용자 요청 2026-11-10) */}
          <RollingSlot
            items={[
              weather && <DayWeatherBadge key="w" weather={weather} />,
              isToday && (
                <span
                  key="today"
                  className="rounded-full bg-primary-weak px-2 py-0.5 text-micro whitespace-nowrap text-primary"
                >
                  {t('date.today')}
                </span>
              ),
              plan?.plan && (
                <span
                  key="plan"
                  className="max-w-36 truncate rounded-full bg-warning/15 px-2 py-0.5 text-micro whitespace-nowrap text-fg"
                >
                  {t(plan.by === 'auto' ? 'planB.badgeAuto' : 'planB.badgePick', {
                    name: plan.plan.name,
                  })}
                </span>
              ),
            ].filter(Boolean)}
          />
          {((canEdit && items.length > 1) ||
            ((copyDayOn || dayRouteOn || (dupOn && canEdit)) && items.length > 0) ||
            // 실험실 "여러 일정 붙여 넣기": 빈 날에도 메뉴
            (bulkOn && canEdit && !!date)) && (
            <IconButton
              label={t('plan.dayMenu', { day: title })}
              icon={<Ellipsis />}
              onClick={onMenu}
            />
          )}
          {onUnfold && (
            <IconButton
              label={t('plan.toolsUnfold')}
              icon={<ChevronDown />}
              aria-expanded={false}
              className="-mr-2"
              onClick={onUnfold}
            />
          )}
        </div>
      </div>
      {/* 여행 중 오늘 일정 진행률: 방문 파랑 · 미방문 빨강 */}
      {isToday && tracked.length > 0 && (
        <div
          className="mx-4 mt-2 flex items-center gap-2"
          aria-label={t('plan.progress', { total: tracked.length, visited, skipped })}
        >
          <span
            aria-hidden="true"
            className="flex h-2 flex-1 overflow-hidden rounded-full bg-bg-subtle"
          >
            <span
              className="h-full bg-primary transition-[width]"
              style={{ width: `${(visited / tracked.length) * 100}%` }}
            />
            <span
              className="h-full bg-danger transition-[width]"
              style={{ width: `${(skipped / tracked.length) * 100}%` }}
            />
          </span>
          <span className="tabular text-micro text-fg-muted" aria-hidden="true">
            <span className="text-primary">{visited}</span>
            {skipped > 0 && <span className="text-danger"> · {skipped}</span>}/{tracked.length}
          </span>
        </div>
      )}
      {/* 실험실: 미세먼지·자외선 (예보 5일 안, 나쁠 때만) */}
      {!weather?.past &&
        airWarnings(weather?.air).map((w) => (
          <p
            key={w.key}
            className="mt-2 rounded-btn bg-warning/10 px-3 py-2 text-caption whitespace-pre-line text-fg-sub"
          >
            <InlineIcon icon={w.key.startsWith('uv') ? SunMedium : Haze} className="text-warning" />
            {t(`air.${w.key}`, { v: w.v })}
          </p>
        ))}
      {/* 실험실: 장소 맞춤 팁 (사원 복장·온천·해변·산) */}
      {tips.map((k) => (
        <p
          key={k}
          className="mt-2 rounded-btn bg-bg-subtle px-3 py-2 text-caption whitespace-pre-line text-fg-sub"
        >
          <InlineIcon icon={PLACE_TIP_ICON[k]} />
          {t(`placeTips.${k}`)}
        </p>
      ))}
      {/* 현지 공휴일: 날짜 아래 작은 한 줄 (간단하게, 사용자 요청 2026-10-28) */}
      {holiday && (
        <p className="mx-4 mt-2 flex items-center gap-1.5 text-caption text-danger">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-danger" />
          <span className="truncate">{t('plan.localHoliday', { name: holiday })}</span>
        </p>
      )}
      {/* 실험실: 오늘 체크아웃 */}
      {outs.map((o, i) => (
        <p
          key={`out-${i}-${o.title}`}
          className="mt-2 flex items-center gap-2 rounded-btn bg-warning/10 px-3 py-2 text-caption text-fg-sub"
        >
          <Luggage aria-hidden="true" className="size-4 shrink-0 text-primary" />
          {o.time
            ? t('labs.checkoutAt', { time: o.time, name: o.title })
            : t('labs.checkout', { name: o.title })}
        </p>
      ))}
      {/* 실험실: 그날 장소 1km 안의 가고 싶은 곳 */}
      {nearby.length > 0 && (
        <p className="mt-2 line-clamp-2 rounded-btn bg-primary-weak px-3 py-2 text-caption text-primary">
          {t('labs.nearbyWish', {
            names: nearby
              .slice(0, 3)
              .map((w) => w.title)
              .join(', '),
            more: nearby.length > 3 ? ` +${nearby.length - 3}` : '',
          })}
        </p>
      )}
      {/* 그날 아침 숙소 조식 (사용자 요청 2026-10-26) */}
      {breakfast && (
        <p className="mt-2 flex items-center gap-2 rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
          <EggFried aria-hidden="true" className="size-4 shrink-0 text-primary" />
          {t('plan.breakfast', { name: breakfast.title })}
        </p>
      )}
      {bookingRows.length > 0 && (
        <ul aria-label={t('plan.bookingsLabel')} className="flex flex-col gap-1 pt-2">
          {bookingRows.map((row) => (
            <BookingLine key={`${row.booking.id}-${row.part}`} row={row} onOpen={onBooking} />
          ))}
        </ul>
      )}
      {items.length === 0 && (
        <p className="px-1 py-3 text-body-2 text-fg-muted">
          {date ? t('plan.emptyDay') : t('plan.wishEmpty')}
        </p>
      )}
      {/* 노선 (docs/29 §4.1, 사용자 요청 2026-11-10): 첫 번호~마지막 번호 가운데를 잇는 선 하나, 번호 원이 그 위를 덮는다.
          가고 싶은 곳은 노선 없음 */}
      <ol
        ref={routeRef}
        style={routeStyle(date ? index : null)}
        className={cn(
          'flex flex-col py-2',
          compact ? 'gap-0.5 [&_[data-item-row]]:py-1.5' : 'gap-1.5',
          date && ROUTE_LINE_CLASS,
        )}
      >
        {todayPast && todayPast.size > 0 && (
          <li>
            <button
              type="button"
              aria-expanded={pastOpen}
              onClick={() => setPastOpen(!pastOpen)}
              className="flex h-9 items-center gap-1 pl-1 text-caption font-semibold text-fg-sub"
            >
              {t('travel.pastN', { n: todayPast.size })}
              <ChevronDown
                aria-hidden="true"
                className={cn('size-4 transition-transform', pastOpen && 'rotate-180')}
              />
            </button>
          </li>
        )}
        {items.map((item, i) => (
          <Fragment key={item.id}>
            {folded?.has(item.id) ? null : (
              <>
                {sun && sunSlot(items, sun.rise) === i && (
                  <SunLine kind="rise" label={t('plan.sunrise')} time={sun.rise} />
                )}
                {sun && sunSlot(items, sun.set) === i && (
                  <SunLine kind="set" label={t('plan.sunset')} time={sun.set} />
                )}
                <ItemRow
                  item={item}
                  // 메모·예약에서 넘어온 일정(항공·숙소·교통)에는 날씨 주의를 넣지 않는다 (사용자 요청 2026-11-10)
                  cautions={
                    item.kind === 'note' || item.bookingId || !forecast
                      ? undefined
                      : weatherCautionsAt(forecast, item.startTime, item.endTime)
                  }
                  n={i + 1}
                  dayIndex={date ? index : null}
                  past={!!past?.has(item.id) || !!item.done}
                  now={item.id === nowId}
                  booking={item.bookingId ? bookingById.get(item.bookingId) : undefined}
                  onOpen={() => onOpen(item)}
                  // 고른 뒤에도 버튼은 남고 고른 것만 칠해진다 (사용자 요청 2026-11-06)
                  onVisit={visitable?.has(item.id) ? (v) => onVisitItem(item, v) : undefined}
                  history={historyOf(item)}
                  onConfirmFlight={(() => {
                    const b = item.bookingId ? bookingById.get(item.bookingId) : undefined;
                    return b && item.transport && recheck.has(b.id)
                      ? () => confirmFlight(b.id, flightSignature(b))
                      : undefined;
                  })()}
                />
                {legs && <LegLine from={item} to={items[i + 1]} />}
              </>
            )}
          </Fragment>
        ))}
        {sun && items.length > 0 && sunSlot(items, sun.rise) === items.length && (
          <SunLine kind="rise" label={t('plan.sunrise')} time={sun.rise} />
        )}
        {sun && items.length > 0 && sunSlot(items, sun.set) === items.length && (
          <SunLine kind="set" label={t('plan.sunset')} time={sun.set} />
        )}
        {/* 늦은 귀가 안내 (설정 "일정") */}
        {lateAt && (
          <li className="mt-1 flex items-start gap-2 rounded-btn bg-primary-weak px-3 py-2 text-caption whitespace-pre-line text-primary">
            <MoonStar aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {t('plan.lateNight', { time: lateAt })}
          </li>
        )}
        {/* 실험실: 하루 돌아보기 (오늘·지난 날, 방문한 곳이 있을 때) */}
        {recap && recap.visited > 0 && (
          <li className="mt-1 rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
            {t('labs.recap', { n: recap.visited, km: recap.km })}
          </li>
        )}
        {/* 마지막 장소에서 숙소까지 */}
        {lodging &&
          lodgingCoords &&
          lastCoords &&
          distanceKm(lastCoords, lodgingCoords) > 0.05 &&
          distanceKm(lastCoords, lodgingCoords) <= FAR_LEG_KM && (
            <li className="flex items-center gap-1.5 py-1 pl-9 text-micro text-fg-muted">
              <BedDouble aria-hidden="true" className="size-3" />
              {t('labs.toLodging', {
                distance: formatDistance(distanceKm(lastCoords, lodgingCoords)),
                min: walkMinutes(distanceKm(lastCoords, lodgingCoords)),
              })}
            </li>
          )}
      </ol>
      {/* 더 짧은 순서 (설정 "일정", 2026-11-13 실험실에서 정식) */}
      {date && items.length > 2 && <ShorterOrderHint items={items} />}
      {noteTrip && date && (
        <DayNoteField
          key={noteTrip.dayNotes?.find((n) => n.date === date)?.text ?? ''}
          trip={noteTrip}
          date={date}
        />
      )}
      {canEdit && (
        <button
          type="button"
          onClick={onAdd}
          className="mb-2 flex h-11 items-center justify-center gap-1 rounded-btn border border-dashed border-line text-body-2 font-medium text-fg-sub"
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
          className="mb-2 -mt-1 flex items-center gap-2 rounded-btn bg-bg-subtle px-3 py-2.5 text-left"
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
