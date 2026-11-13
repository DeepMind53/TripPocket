import { addDays, dayNumberOf, todayIn, type ItineraryItem, type Trip } from '@trippocket/shared';
import {
  Bed,
  Bell,
  BellOff,
  CloudSun,
  House,
  IdCard,
  Languages,
  ListChecks,
  Sun,
  Ticket,
  TriangleAlert,
  Wallet,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { TravelTabPanel } from './TravelTabPanel';
import { isTravelTab, type TravelTabId } from './travelTabs';
import { useTrip, useTripBookings, useTripItems } from '../../data/hooks';
import { setTravelMode, setTravelPrefs, useTravelMode } from '../../data/travelModeStore';
import { airWarnings } from '../../domain/air';
import { lodgingForNight } from '../../domain/lodging';
import { dayPhase, rainFrom, type DayPhase } from '../../domain/travelDay';
import { travelLegsAhead } from '../../domain/travelLeg';
import { isDomesticTrip } from '../../domain/tripPlace';
import { formatTemps } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { timeIn, useMinuteClock } from '../../shared/hooks/useMinuteClock';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { cn } from '../../shared/lib/cn';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import type { Destination } from '../../shared/lib/directions';
import { Button, IconButton, Skeleton, toast } from '../../shared/ui';
import { InlineIcon } from '../../shared/ui/InlineIcon';
import { DayWeatherBadge } from '../common/DayWeatherBadge';
import { DirectionsSheet } from '../common/DirectionsSheet';
import { openDirectionsDirect } from '../common/openDirections';
import { QuickMenuButton } from '../common/QuickMenu';
import { TravelLegCard } from '../common/TravelLegCard';
import { useTripWeather } from '../common/useTripWeather';
import { useTripHolidays } from '../itinerary/useTripHolidays';
import { useTripPlanItems } from '../itinerary/usePlanView';
import { OngoingTrip } from '../home/OngoingTrip';
import { TripStrip } from '../home/TripStrip';

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** 인터넷 연결 여부 (끊기면 머리에 작은 칩, D3) */
const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};
const useOnline = () =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

/** 엄지 버튼: 숙소로 길찾기 고정 + 시간대별 3칸 (docs/27 Q3) */
type Thumb = { id: TravelTabId; icon: LucideIcon };
const THUMBS: Record<DayPhase, Thumb[]> = {
  morning: [
    { id: 'weather', icon: CloudSun },
    { id: 'checklist', icon: ListChecks },
    { id: 'bookings', icon: Ticket },
  ],
  day: [
    { id: 'fx', icon: Wallet },
    { id: 'phrases', icon: Languages },
    { id: 'bookings', icon: Ticket },
  ],
  evening: [
    { id: 'bookings', icon: Ticket },
    { id: 'weather', icon: CloudSun },
    { id: 'essentials', icon: IdCard },
  ],
};

/**
 * 여행 모드 (실험실, docs/25 + docs/27 개선 — 2026-11-04 결정 Q1~Q5):
 * 시각에 따라 맨 위가 바뀐다 — 아침 브리핑 → 지금·다음(나갈 시각) → 저녁 정리·내일 미리보기.
 * 고치는 기능은 없고 방문 표시(다녀옴·건너뛰기)만. [홈]이면 여행 모드를 끄고 일반 화면으로
 */
export function TravelModePage() {
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const items = useTripItems(tripId);
  if (!trip || !items) return <Skeleton />;
  return <TravelView trip={trip} items={items} />;
}

function TravelView({ trip, items: all }: { trip: Trip; items: ItineraryItem[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const bookings = useTripBookings(trip.id) ?? [];
  const items = useTripPlanItems(trip, all);
  const weather = useTripWeather(trip);
  const holidays = useTripHolidays(trip, true);
  const { sun, remind, sunAsked } = useTravelMode();
  const online = useOnline();
  const [dirOpen, setDirOpen] = useRouteSheet('travel-directions');
  const [dest, setDest] = useState<Destination | null>(null);
  // 아래 탭으로 연 화면 (?tab=fx&trip=… — 환율·번역 화면이 trip으로 여행을 안다). 뒤로 가기 = 여행 모드 첫 화면
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab = isTravelTab(tabParam) ? tabParam : null;
  const today = todayIn(trip.timezone);
  const tomorrow = addDays(today, 1);
  const clock = useMinuteClock(true);
  const now = timeIn(trip.timezone, clock) ?? '00:00';
  const dayItems = items.filter((i) => i.date === today && i.kind !== 'note');
  const phase = dayPhase(dayItems, now);
  const n = dayNumberOf(trip.startDate, trip.endDate, today);
  const domestic = isDomesticTrip(trip);
  // 오늘 밤 숙소 → 없으면 첫 숙소 (빠른 메뉴 "숙소로 길찾기"와 같은 규칙)
  const stay =
    lodgingForNight(bookings, today)?.booking ?? bookings.find((b) => b.kind === 'lodging');
  const w = weather[today];

  const directions = (d: Destination) => {
    if (openDirectionsDirect(d, domestic)) return;
    setDest(d);
    setDirOpen(true);
  };
  const toStay = () => {
    if (!stay) return toast(t('quickMenu.noLodging'));
    directions({ name: stay.title, address: stay.details?.address });
  };

  // 오늘 주의 한 줄 (D2): 비 → 미세먼지·자외선 → 현지 공휴일 중 가장 앞의 것
  const rain = rainFrom(w, now);
  const air = airWarnings(w?.air)[0];
  const caution =
    rain !== null
      ? rain < 0
        ? t('travel.rainToday')
        : t('travel.rainFrom', { h: rain })
      : air
        ? t(`air.${air.key}`, { v: air.v })
        : holidays[today]
          ? t('travel.holiday', { name: holidays[today] })
          : null;

  // 이동 중이거나 3시간 안에 떠나는 비행기·기차·버스·렌터카 (B2)
  const legs = travelLegsAhead(bookings, today, now);
  const leg = legs[0];
  const legSoon =
    leg &&
    leg.booking.start.date <= today &&
    (!leg.booking.start.time ||
      leg.booking.start.date < today ||
      mins(leg.booking.start.time) - mins(now) <= 180);

  const tomorrowItems = items
    .filter((i) => i.date === tomorrow && i.kind !== 'note')
    .sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
  const tomorrowFirst = tomorrowItems.find((i) => i.startTime) ?? tomorrowItems[0];
  const visitedCount = dayItems.filter((i) => i.visit === 'visited').length;
  const firstTimed = dayItems.find((i) => i.startTime);

  const hour = Number(now.slice(0, 2));
  const suggestSun = !sun && !sunAsked && hour >= 10 && hour < 16;

  return (
    <div
      className={cn(
        'mx-auto flex min-h-dvh max-w-[560px] flex-col gap-3 px-5 pb-44',
        sun && 'travel-sun',
      )}
    >
      {tab ? (
        <TravelTabPanel id={tab} tripId={trip.id} />
      ) : (
        <>
          {/* 머리는 일정표 머리(TopBar)와 같은 자리·높이: 홈 버튼이 화면을 오가도 같은 곳에 (사용자 요청 2026-11-04) */}
          <header className="sticky top-0 z-20 -mx-5 flex min-h-[calc(56px+var(--safe-top))] items-center gap-1 bg-bg/95 px-1 pt-[var(--safe-top)] backdrop-blur">
            {/* 여행 모드 끄기 = 홈 모양, 왼쪽 (사용자 요청 2026-11-03) */}
            <IconButton
              label={t('travel.exit')}
              icon={<House />}
              tone="tint"
              onClick={() => {
                setTravelMode(trip.id, false);
                void navigate(`/trips/${trip.id}/plan`, { replace: true });
              }}
            />
            {/* 왼쪽: 일차·날짜, 아래 날씨 / 오른쪽 남은 칸: 현지 시각을 칸 너비만큼 크게 — 머리 높이는 그대로 (사용자 요청 2026-11-10) */}
            <span className="flex shrink-0 flex-col items-start">
              <span className="text-title-2 font-semibold whitespace-nowrap">
                {n ? t('travel.dayN', { n, date: formatMonthDay(today) }) : formatMonthDay(today)}
              </span>
              <DayWeatherBadge weather={w} />
            </span>
            <span className="@container flex h-14 min-w-0 flex-1 items-center justify-end">
              <span className="tabular text-[min(2.25rem,15cqi)] leading-none font-medium whitespace-nowrap text-fg-sub">
                {t('travel.localTime', { time: now })}
              </span>
            </span>
            <IconButton
              label={t('travel.sun')}
              aria-pressed={sun}
              icon={<Sun />}
              tone={sun ? 'tint' : 'plain'}
              onClick={() => setTravelPrefs({ sun: !sun, sunAsked: true })}
            />
            {/* 오른쪽 위 긴급 연락처 버튼은 뺐다 (사용자 요청 2026-11-10, 전에는 D1) */}
          </header>

          {!online && (
            <p className="flex items-center gap-1.5 self-start rounded-full bg-bg-subtle px-3 py-1 text-caption text-fg-sub">
              <WifiOff aria-hidden="true" className="size-3.5" />
              {t('travel.offline')}
            </p>
          )}
          {caution && (
            <p className="rounded-btn bg-warning/10 px-3 py-2 text-caption whitespace-pre-line text-fg-sub">
              <InlineIcon icon={TriangleAlert} className="text-warning" />
              {caution}
            </p>
          )}
          {suggestSun && (
            <div className="flex items-center gap-2 rounded-btn bg-bg-subtle px-3 py-1.5 text-caption">
              <span className="flex-1">{t('travel.sunAsk')}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setTravelPrefs({ sunAsked: true })}
              >
                {t('travel.decline')}
              </Button>
              <Button size="sm" onClick={() => setTravelPrefs({ sun: true, sunAsked: true })}>
                {t('travel.sunOn')}
              </Button>
            </div>
          )}

          {legSoon && leg && (
            <TravelLegCard
              leg={leg}
              next={legs[1]}
              tripId={trip.id}
              onCar={() => void navigate(`/trips/${trip.id}/bookings`)}
            />
          )}

          {/* 홈 여행 중 화면과 그대로 (사용자 요청 2026-11-13): 여행 카드(일정 막대) → 다음 일정 카드 → 오늘 일정표.
              아침 브리핑은 다음 일정 위, 저녁 정리는 그 아래 */}
          <TripStrip trip={trip} link={false} />
          <OngoingTrip
            trip={trip}
            travel
            hideDone={phase === 'evening'}
            beforeNext={
              // 아침 브리핑 (A2): 첫 일정 전까지
              phase === 'morning' && (
                <section
                  aria-label={t('travel.morning')}
                  className="flex flex-col gap-1 rounded-card bg-bg-subtle p-4"
                >
                  <span className="text-caption font-semibold text-fg-muted">
                    {t('travel.morning')}
                  </span>
                  <span className="text-body-1 font-semibold">
                    {t('travel.briefing', {
                      n: dayItems.length,
                      time: firstTimed?.startTime ?? '',
                    })}
                  </span>
                  {w && <span className="tabular text-caption text-fg-sub">{formatTemps(w)}</span>}
                </section>
              )
            }
            afterNext={
              // 저녁 정리 + 내일 미리보기 (A5·A6, Q1)
              phase === 'evening' && (
                <section
                  aria-label={t('travel.evening')}
                  className="flex flex-col gap-2 rounded-card bg-bg-subtle p-4"
                >
                  <span className="text-caption font-semibold text-fg-muted">
                    {t('travel.evening')}
                  </span>
                  <span className="text-body-1 font-semibold">
                    {t('travel.recap', { n: dayItems.length, done: visitedCount })}
                  </span>
                  <span className="border-t border-dashed border-line pt-2 text-caption font-semibold text-fg-muted">
                    {t('travel.tomorrow')}
                  </span>
                  {tomorrowFirst ? (
                    <span className="text-body-2">
                      {t('travel.tomorrowFirst', {
                        time: tomorrowFirst.startTime ?? '',
                        title: tomorrowFirst.title,
                      })}
                    </span>
                  ) : (
                    <span className="text-body-2 text-fg-muted">{t('travel.tomorrowNone')}</span>
                  )}
                  {weather[tomorrow] && (
                    <span className="tabular text-caption text-fg-sub">
                      {formatTemps(weather[tomorrow])}
                    </span>
                  )}
                  <Button
                    size="lg"
                    fullWidth
                    leading={<Bed aria-hidden="true" className="size-5" />}
                    onClick={toStay}
                  >
                    {t('travel.toStay')}
                  </Button>
                </section>
              )
            }
          />

          <Button
            variant="ghost"
            leading={
              remind ? (
                <Bell aria-hidden="true" className="size-4" />
              ) : (
                <BellOff aria-hidden="true" className="size-4" />
              )
            }
            onClick={() => {
              if (
                !remind &&
                typeof Notification !== 'undefined' &&
                Notification.permission === 'default'
              )
                void Notification.requestPermission();
              setTravelPrefs({ remind: !remind });
            }}
          >
            {t(remind ? 'travel.remindOn' : 'travel.remindOff')}
          </Button>
        </>
      )}

      {/* 엄지 버튼: 숙소로 길찾기 고정 + 시간대별 3칸 (Q3). 누르면 화면을 옮기지 않고 위 내용만 바꾼다 —
          아래 탭은 그대로 (사용자 요청 2026-11-10). 고른 탭을 다시 누르면 여행 모드 첫 화면 */}
      <nav
        aria-label={t('travel.thumb')}
        className="fixed inset-x-0 bottom-0 mx-auto grid max-w-[560px] grid-cols-4 gap-2 border-t border-line bg-surface px-4 pt-2 pb-[calc(var(--safe-bottom,0px)+8px)]"
      >
        <button
          type="button"
          onClick={toStay}
          // 다른 칸과 같은 회색, 누를 때만 파랑 (사용자 요청 2026-11-11)
          className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-btn bg-bg-subtle text-micro font-semibold active:bg-primary-weak active:text-primary"
        >
          <Bed aria-hidden="true" className="size-5 text-primary" />
          {t('travel.toStay')}
        </button>
        {THUMBS[phase].map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() =>
              setParams(tab === id ? {} : { tab: id, trip: trip.id }, { preventScrollReset: false })
            }
            className={cn(
              'flex h-14 flex-col items-center justify-center gap-0.5 rounded-btn text-micro font-semibold',
              tab === id ? 'bg-primary-weak text-primary' : 'bg-bg-subtle',
            )}
          >
            <Icon aria-hidden="true" className="size-5 text-primary" />
            {t(`travel.thumbs.${id}`)}
          </button>
        ))}
      </nav>
      <QuickMenuButton inTrip travel />
      <DirectionsSheet
        open={dirOpen}
        onOpenChange={setDirOpen}
        destination={dest}
        isDomestic={domestic}
      />
    </div>
  );
}
