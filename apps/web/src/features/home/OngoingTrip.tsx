import {
  SAVED_PLACES_MAX,
  addDays,
  dayNumberOf,
  todayIn,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';
import { BedDouble, ChevronDown, Copy, Navigation } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTripBookings, useTripItems } from '../../data/hooks';
import { useSettings } from '../../data/settingsStore';
import { applyVisit } from '../../data/skippedToSaved';
import { setTravelMode, useTravelMode } from '../../data/travelModeStore';
import { pastItemIds } from '../../domain/dayTools';
import { lodgingForNight, minutesUntil, nextItem, nowTimeIn } from '../../domain/lodging';
import { leaveAt } from '../../domain/travelDay';
import { isDomesticTrip } from '../../domain/tripPlace';
import type { Visit } from '../../domain/visit';
import { hourWeather, weatherLook } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { useMinuteClock } from '../../shared/hooks/useMinuteClock';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { useTimeText } from '../../shared/hooks/useTimeText';
import { copyText } from '../../shared/lib/clipboard';
import { cn } from '../../shared/lib/cn';
import type { Destination } from '../../shared/lib/directions';
import {
  Button,
  NextStopCard,
  RouteLine,
  RouteStop,
  WeatherIcon,
  routeColor,
  toast,
} from '../../shared/ui';
import { openDirectionsDirect } from '../common/openDirections';
import { useTripWeather } from '../common/useTripWeather';
import { VisitToggle } from '../common/VisitToggle';
import { useTripPlanItems } from '../itinerary/usePlanView';
import { DepartCountdown } from '../travel/DepartCountdown';
import { LegControls } from '../travel/LegControls';
import { useNextLeg } from '../travel/useNextLeg';

// 여행 중 특보 한 줄·실험실 한 줄 — 첫 화면에 넣지 않고 따로 받는다
const HomeLabs = lazy(async () => ({ default: (await import('./HomeLabs')).HomeLabs }));
const TripAlertBanner = lazy(async () => ({
  default: (await import('../weather/TripAlertBanner')).TripAlertBanner,
}));
// 오늘 실험 줄 — 첫 화면에 넣지 않고 따로 받는다
const TodayLabs = lazy(async () => ({
  default: (await import('../labs/TodayLabs')).TodayLabs,
}));
// 길찾기 시트(이동수단 고르기)는 누를 때 불러온다 — 첫 화면 크기
const DirectionsSheet = lazy(async () => ({
  default: (await import('../common/DirectionsSheet')).DirectionsSheet,
}));

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** 지난 일정 시각 → 다음 일정 시각 사이에서 지금이 어디쯤인지 (0~1, 다음 일정 카드 진행 막대) */
function progressBetween(prev: ItineraryItem, next: ItineraryItem, now: string): number | null {
  if (!prev.startTime || !next.startTime) return null;
  const span = toMin(next.startTime) - toMin(prev.startTime);
  if (span <= 0) return null;
  return (toMin(now) - toMin(prev.startTime)) / span;
}

/**
 * 여행 중 오늘: 다음 일정 카드 + 오늘 일정표 (+ 홈에서는 특보·오늘 숙소).
 * 홈과 여행 모드가 같은 화면을 쓴다 (사용자 요청 2026-11-13 "여행 모드도 홈과 그대로").
 * - travel: 여행 모드 — 특보·실험실·숙소 카드는 여행 모드 머리·엄지 버튼에 있어 뺀다,
 *   [일정 보기]는 여행 모드를 끄고 그날 일정으로, 나갈 시각 알림
 * - beforeNext / afterNext: 여행 모드 아침 브리핑·저녁 정리 자리
 * - hideDone: 다음 일정이 없을 때 "오늘 일정 끝" 칸을 숨긴다 (여행 모드 저녁 정리가 대신)
 */
export function OngoingTrip({
  trip,
  travel = false,
  beforeNext,
  afterNext,
  hideDone = false,
}: {
  trip: Trip;
  travel?: boolean;
  beforeNext?: ReactNode;
  afterNext?: ReactNode;
  hideDone?: boolean;
}) {
  const { time } = useTimeText();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // 분이 바뀔 때·앱으로 돌아올 때 다시 그리기 (현지 시각·남은 시간, 2026-11-13 실제 분에 맞춤)
  const clock = useMinuteClock(true);
  // Plan B: 오늘 일정도 지금 보이는 플랜 기준 (실험실을 끄면 기본 일정만)
  const items = useTripPlanItems(trip, useTripItems(trip.id) ?? []);
  const bookings = useTripBookings(trip.id) ?? [];
  const weather = useTripWeather(trip);
  const [dirOpen, setDirOpen] = useRouteSheet('directions');
  const [dest, setDest] = useState<Destination | null>(null);

  const today = todayIn(trip.timezone);
  const day = dayNumberOf(trip.startDate, trip.endDate, today) ?? 1;
  const todayItems = (items ?? []).filter((i) => i.date === today);
  const now = nowTimeIn(trip.timezone, clock);
  const next = nextItem(todayItems, now);
  // 지난 일정 (방문·미방문을 고를 수 있는 것) — 일정 탭과 같은 규칙
  const past = pastItemIds(todayItems, today, now);
  // 다음 역 카드를 그날 노선 색으로 (설정)
  const dayColorOn = useSettings((st) => st.nextStopDayColor);
  // 지난 일정 접기 (사용자 결정 2026-11-10) — 다음 일정·남은 일정이 바로 보이게
  const [pastOpen, setPastOpen] = useState(false);
  const pastList = todayItems.filter((i) => past.has(i.id));
  const shown = pastOpen ? todayItems : todayItems.filter((i) => !past.has(i.id));
  // 진행 막대의 출발점: 다음 일정 바로 앞, 시각이 있는 일정
  const nextIdx = next ? todayItems.findIndex((i) => i.id === next.id) : -1;
  const prevStop =
    nextIdx > 0
      ? ([...todayItems.slice(0, nextIdx)].reverse().find((i) => i.startTime) ?? null)
      : null;
  async function markVisit(item: ItineraryItem, v: Visit | null) {
    const r = await applyVisit(item, v, trip);
    if (r === 'saved') toast(t('visit.savedToSaved'));
    else if (r === 'limit') toast(t('saved.limit', { max: SAVED_PLACES_MAX }));
  }
  // 오늘 다 끝나면 내일 첫 일정
  const tomorrow = addDays(today, 1);
  const tomorrowFirst =
    !next && tomorrow <= trip.endDate
      ? ((items ?? []).find((i) => i.date === tomorrow && !i.done) ?? null)
      : null;
  const lodging = travel ? null : lodgingForNight(bookings, today);
  // 다음 일정까지 이동: [도보|대중교통|자동차]·[새로고침]·출발까지 남은 시간
  const nextLeg = useNextLeg(
    todayItems.filter((i) => i.kind !== 'note'),
    next ?? undefined,
  );
  const planUrl = `/trips/${trip.id}/plan?day=${day}`;

  // 여행 모드: 나갈 시각 알림 (앱이 열려 있을 때 — 브라우저 알림 권한을 허락한 경우)
  const remind = useTravelMode((s) => s.remind) && travel;
  const leave = next?.startTime ? leaveAt(next.startTime, now, nextLeg.travelMin) : null;
  useEffect(() => {
    if (!remind || !leave || leave.inMin < 0 || !next) return;
    const timer = window.setTimeout(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification(t('travel.remindTitle'), { body: next.title });
      navigator.vibrate?.(200);
    }, leave.inMin * 60_000);
    return () => window.clearTimeout(timer);
  }, [remind, leave?.inMin, next, t]); // eslint-disable-line react-hooks/exhaustive-deps

  function directions(d: Destination) {
    if (openDirectionsDirect(d, isDomesticTrip(trip))) return;
    setDest(d);
    setDirOpen(true);
  }

  function countdown(item: ItineraryItem): string | null {
    if (!item.startTime) return null;
    const m = minutesUntil(now, item.startTime);
    if (m <= 0) return t('home.now');
    if (m < 60) return t('home.inMinutes', { n: m });
    return t('home.inHours', { h: Math.floor(m / 60), m: m % 60 });
  }

  // 남은 일정: 오른쪽에 그 시각 날씨 (예보가 있는 날만, 작년 기록은 빼고 — 2026-11-10, 홈에도 2026-11-13)
  const w = weather[today];
  const hourMark = (i: ItineraryItem) => {
    const h = w && !w.year ? hourWeather(w, i.startTime) : null;
    if (!h) return undefined;
    const look = weatherLook(h.code);
    return (
      <span
        role="img"
        aria-label={t('travel.hourWeather', { look: look.label, temp: h.temp })}
        className="flex shrink-0 items-center gap-1"
      >
        <WeatherIcon kind={look.kind} className="size-5" />
        <span aria-hidden="true" className="tabular text-caption text-fg-sub">
          {h.temp}°
        </span>
      </span>
    );
  };

  const viewPlanCls =
    'flex h-11 flex-1 items-center justify-center rounded-btn bg-on-primary/20 px-3 text-body-2 font-medium text-on-primary';

  return (
    <>
      {!travel && (
        <>
          {/* 여행 이름·배지는 맨 위 여행 카드에 있어 여기서는 뺀다 (2026-11-06) */}
          <Suspense fallback={null}>
            <TripAlertBanner trip={trip} />
          </Suspense>
          {/* 무료 취소 마감 (실험실) */}
          <Suspense fallback={null}>
            <HomeLabs trip={trip} bookings={bookings} ongoing />
          </Suspense>
        </>
      )}

      {beforeNext}

      {next ? (
        // 다음 일정 카드 (docs/29 §4.4, 사용자 결정 Q3 파랑 채움): 남은 시간 크게 + 지난 일정 → 다음 일정 진행 막대
        <NextStopCard
          tone={dayColorOn ? routeColor(day - 1).ink : undefined}
          label={t('home.nextItem')}
          kicker={t('home.nextItem')}
          title={next.title}
          // 고른 이동 수단으로 계산한 출발까지 남은 시간. 시각이 없으면 예전처럼
          countdown={
            next.startTime ? (
              <DepartCountdown
                start={next.startTime}
                timezone={trip.timezone}
                travelMin={nextLeg.travelMin}
              />
            ) : (
              countdown(next)
            )
          }
          note={nextLeg.note}
          progress={prevStop && next.startTime ? progressBetween(prevStop, next, now) : null}
          progressLabel={prevStop ? `${prevStop.title} → ${next.title}` : undefined}
          from={prevStop?.title}
          to={next.title}
          actions={
            <div className="flex flex-1 flex-col gap-2">
              {nextLeg.hasRoute && (
                <LegControls
                  mode={nextLeg.mode}
                  onMode={nextLeg.onMode}
                  hasWalk={nextLeg.opts.walk !== undefined}
                  hasTransit={nextLeg.opts.transit !== undefined}
                  hereDisabled={nextLeg.hereDisabled}
                  left={nextLeg.left}
                  onHere={nextLeg.onHere}
                />
              )}
              {/* [길찾기]·[일정 보기]는 그대로 (사용자 요청 2026-11-13) */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    directions({
                      name: next.place?.name ?? next.title,
                      address: next.place?.address,
                      coords: next.place?.coords,
                    })
                  }
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-btn bg-on-primary px-3 text-body-2 font-medium text-primary"
                >
                  <Navigation aria-hidden="true" className="size-4" />
                  {t('home.directions')}
                </button>
                {travel ? (
                  // 여행 모드에서는 일정 화면이 다시 여행 모드로 돌아와서, 여행 모드를 끄고 그날 일정으로
                  <button
                    type="button"
                    onClick={() => {
                      setTravelMode(trip.id, false);
                      void navigate(planUrl, { replace: true });
                    }}
                    className={viewPlanCls}
                  >
                    {t('home.viewPlan')}
                  </button>
                ) : (
                  <Link to={planUrl} className={viewPlanCls}>
                    {t('home.viewPlan')}
                  </Link>
                )}
              </div>
            </div>
          }
        />
      ) : (
        items &&
        !hideDone && (
          <div className="flex flex-col gap-1 rounded-card bg-bg-subtle p-4 text-body-2 text-fg-sub">
            <p>{todayItems.length === 0 ? t('home.noItemsToday') : t('home.allDone')}</p>
            {tomorrowFirst && !travel && (
              <Link
                to={`/trips/${trip.id}/plan?day=${day + 1}`}
                className="tabular font-semibold text-primary"
              >
                {t('home.tomorrowFirst', {
                  time: time(tomorrowFirst.startTime) ?? '',
                  title: tomorrowFirst.title,
                })}
              </Link>
            )}
          </div>
        )
      )}

      {afterNext}

      {/* 실험실 (2026-11-13): 오늘의 한마디·걷기 좋은 시간·해 지기까지·숙소 알려 주기 */}
      <Suspense fallback={null}>
        <TodayLabs
          trip={trip}
          today={today}
          dayN={day}
          now={now}
          weather={w}
          coords={todayItems.find((i) => i.place?.coords)?.place?.coords}
          stay={lodgingForNight(bookings, today)?.booking}
        />
      </Suspense>

      {todayItems.length > 0 && (
        <section
          aria-label={t('home.todayItems', { n: todayItems.length })}
          className="flex flex-col rounded-card border border-line bg-surface px-4 py-2"
        >
          <div className="flex min-h-11 items-center justify-between gap-2">
            <h2 className="text-body-2 font-semibold">
              {t('home.todayItems', { n: todayItems.length })}
            </h2>
            {/* 지난 일정은 접어 둔다 (사용자 결정 2026-11-10) */}
            {pastList.length > 0 && (
              <button
                type="button"
                aria-expanded={pastOpen}
                onClick={() => setPastOpen(!pastOpen)}
                className="flex h-9 items-center gap-1 text-caption font-semibold text-fg-sub"
              >
                {t('travel.pastN', { n: pastList.length })}
                <ChevronDown
                  aria-hidden="true"
                  className={cn('size-4 transition-transform', pastOpen && 'rotate-180')}
                />
              </button>
            )}
          </div>
          {/* 오늘 노선 (docs/29 §7.1): 지난 일정은 흐리게 + 오른쪽 [미방문][방문], 남은 일정은 그 시각 날씨 */}
          <RouteLine label={t('home.todayItems', { n: todayItems.length })} dayIndex={day - 1}>
            {shown.map((item, i) => (
              <RouteStop
                key={item.id}
                number={item.kind === 'note' ? undefined : todayItems.indexOf(item) + 1}
                state={item.id === next?.id ? 'next' : past.has(item.id) ? 'past' : 'default'}
                mark={item.visit ?? null}
                title={item.title}
                time={time(item.startTime) ?? undefined}
                last={i === shown.length - 1}
                dense
                trailing={
                  item.kind === 'note' ? undefined : past.has(item.id) ? (
                    <VisitToggle
                      value={item.visit}
                      label={item.title}
                      onChange={(v) => void markVisit(item, v)}
                    />
                  ) : (
                    hourMark(item)
                  )
                }
              />
            ))}
          </RouteLine>
        </section>
      )}

      {lodging && (
        <section
          aria-label={t('home.lodgingTonight')}
          className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
        >
          <p className="flex items-center gap-2 text-caption font-semibold text-fg-muted">
            <BedDouble aria-hidden="true" className="size-4 text-day-4" />
            {t('home.lodgingTonight')}
            <span className="tabular font-medium">
              {lodging.night}/{lodging.nights}
            </span>
          </p>
          <p className="text-body-1">{lodging.booking.title}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              leading={<Navigation aria-hidden="true" className="size-4" />}
              onClick={() =>
                directions({
                  name: lodging.booking.title,
                  address: lodging.booking.details?.address,
                })
              }
            >
              {t('home.directions')}
            </Button>
            {lodging.booking.confirmationNo && (
              <Button
                size="sm"
                variant="secondary"
                className="tabular"
                leading={<Copy aria-hidden="true" className="size-4" />}
                aria-label={t('bookings.copyNo', { no: lodging.booking.confirmationNo })}
                onClick={() =>
                  void copyText(lodging.booking.confirmationNo as string, t('bookings.copied'))
                }
              >
                {lodging.booking.confirmationNo}
              </Button>
            )}
          </div>
        </section>
      )}

      {dirOpen && (
        <Suspense fallback={null}>
          <DirectionsSheet
            open={dirOpen}
            onOpenChange={setDirOpen}
            destination={dest}
            isDomestic={isDomesticTrip(trip)}
          />
        </Suspense>
      )}
    </>
  );
}
