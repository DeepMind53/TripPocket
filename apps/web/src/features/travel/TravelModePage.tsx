import {
  addDays,
  dayNumberOf,
  todayIn,
  type Coords,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';
import {
  Bed,
  Bell,
  BellOff,
  ChevronDown,
  CloudSun,
  House,
  IdCard,
  Languages,
  ListChecks,
  Navigation,
  Siren,
  Sun,
  Ticket,
  TriangleAlert,
  Wallet,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams } from 'react-router';
import { routeEta } from '../../data/api/routes';
import { useTrip, useTripBookings, useTripItems } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { setTravelMode, setTravelPrefs, useTravelMode } from '../../data/travelModeStore';
import { airWarnings } from '../../domain/air';
import { currentItemId, nextStop } from '../../domain/dayTools';
import { lodgingForNight } from '../../domain/lodging';
import { dayPhase, leaveAt, rainFrom, type DayPhase } from '../../domain/travelDay';
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
import { EmergencySheet } from '../common/EmergencySheet';
import { openDirectionsDirect } from '../common/openDirections';
import { QuickMenuButton } from '../common/QuickMenu';
import { TravelLegCard } from '../common/TravelLegCard';
import { useTripWeather } from '../common/useTripWeather';
import { useTripHolidays } from '../itinerary/useTripHolidays';
import { useTripPlanItems } from '../itinerary/usePlanView';

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
type ThumbId = 'weather' | 'checklist' | 'bookings' | 'fx' | 'phrases' | 'essentials';
type Thumb = { id: ThumbId; icon: LucideIcon; path: (tripId: string) => string };
const THUMBS: Record<DayPhase, Thumb[]> = {
  morning: [
    { id: 'weather', icon: CloudSun, path: (id) => `/trips/${id}/weather` },
    { id: 'checklist', icon: ListChecks, path: (id) => `/trips/${id}/checklist` },
    { id: 'bookings', icon: Ticket, path: (id) => `/trips/${id}/bookings` },
  ],
  day: [
    { id: 'fx', icon: Wallet, path: (id) => `/fx?trip=${id}` },
    { id: 'phrases', icon: Languages, path: (id) => `/phrases?trip=${id}` },
    { id: 'bookings', icon: Ticket, path: (id) => `/trips/${id}/bookings` },
  ],
  evening: [
    { id: 'bookings', icon: Ticket, path: (id) => `/trips/${id}/bookings` },
    { id: 'weather', icon: CloudSun, path: (id) => `/trips/${id}/weather` },
    { id: 'essentials', icon: IdCard, path: (id) => `/trips/${id}/essentials` },
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
  const [sosOpen, setSosOpen] = useRouteSheet('travel-emergency');
  const [dest, setDest] = useState<Destination | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const today = todayIn(trip.timezone);
  const tomorrow = addDays(today, 1);
  const clock = useMinuteClock(true);
  const now = timeIn(trip.timezone, clock) ?? '00:00';
  const dayItems = items.filter((i) => i.date === today && i.kind !== 'note');
  const phase = dayPhase(dayItems, now);
  const nowId = currentItemId(dayItems, now);
  const current = dayItems.find((i) => i.id === nowId);
  const next = nextStop(dayItems, now);
  const n = dayNumberOf(trip.startDate, trip.endDate, today);
  const domestic = isDomesticTrip(trip);
  // 오늘 밤 숙소 → 없으면 첫 숙소 (빠른 메뉴 "숙소로 길찾기"와 같은 규칙)
  const stay =
    lodgingForNight(bookings, today)?.booking ?? bookings.find((b) => b.kind === 'lodging');
  const w = weather[today];
  const countries = [
    ...new Set(trip.destinations.map((d) => d.countryCode).filter((c): c is string => !!c)),
  ];

  // 다음 일정까지 이동 시간 (Q4): 앞 일정 장소 → 다음 장소, 일정마다 한 번 (기기에 7일 보관, 무료량 안에서만)
  const prev = next
    ? [...dayItems]
        .filter((i) => i.place?.coords && i.startTime && i.startTime < next.startTime!)
        .pop()
    : undefined;
  const from: Coords | undefined = prev?.place?.coords;
  const to = next?.place?.coords;
  const pair = from && to ? `${from.lat},${from.lng}>${to.lat},${to.lng}` : '';
  const [eta, setEta] = useState<{ pair: string; min?: number; transit: boolean } | null>(null);
  useEffect(() => {
    if (!pair || !from || !to || eta?.pair === pair) return;
    let alive = true;
    const google = next?.place?.coordsSource === 'google' || prev?.place?.coordsSource === 'google';
    void routeEta(from, to, google).then((r) => {
      if (!alive) return;
      const transit = r?.transit;
      const walk = r?.walk;
      const best = [walk, transit].filter((x): x is number => x !== undefined);
      setEta({
        pair,
        ...(best.length ? { min: Math.min(...best) } : {}),
        transit: transit !== undefined && (walk === undefined || transit < walk),
      });
    });
    return () => {
      alive = false;
    };
  }, [pair]); // eslint-disable-line react-hooks/exhaustive-deps -- 다음 일정(두 장소)이 바뀔 때만
  const travelMin = eta?.pair === pair ? eta.min : undefined;
  const leave = next?.startTime ? leaveAt(next.startTime, now, travelMin) : null;

  // 나갈 시각 알림 (앱이 열려 있을 때 — 브라우저 알림 권한을 허락한 경우)
  useEffect(() => {
    if (!remind || !leave || leave.inMin < 0 || !next) return;
    const timer = window.setTimeout(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification(t('travel.remindTitle'), { body: next.title });
      navigator.vibrate?.(200);
    }, leave.inMin * 60_000);
    return () => window.clearTimeout(timer);
  }, [remind, leave?.inMin, next, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const directions = (d: Destination) => {
    if (openDirectionsDirect(d, domestic)) return;
    setDest(d);
    setDirOpen(true);
  };
  const go = (i: ItineraryItem) =>
    directions({
      name: i.place?.name ?? i.title,
      address: i.place?.address,
      coords: i.place?.coords,
    });
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

  const visitButtons = (i: ItineraryItem) =>
    i.startTime &&
    i.startTime <= now &&
    !i.visit && (
      <span className="flex shrink-0 gap-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void itemRepo.setVisit(i.id, 'skipped')}
        >
          {t('travel.skip')}
        </Button>
        <Button size="sm" onClick={() => void itemRepo.setVisit(i.id, 'visited')}>
          {t('travel.visited')}
        </Button>
      </span>
    );

  const row = (i: ItineraryItem) => (
    <li key={i.id} className="flex min-h-12 items-center gap-2 px-3 py-2">
      <span className="tabular w-12 shrink-0 text-caption text-fg-muted">
        {i.startTime ?? '--:--'}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-body-1',
          i.visit && 'text-fg-muted line-through',
        )}
      >
        {i.title}
      </span>
      {visitButtons(i)}
    </li>
  );

  const ended = (i: ItineraryItem) =>
    !!i.startTime &&
    i.id !== nowId &&
    (!next || i.startTime < next.startTime!) &&
    i.startTime < now;
  const pastItems = dayItems.filter(ended);
  const restItems = dayItems.filter((i) => !ended(i));

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
        'mx-auto flex min-h-dvh max-w-[560px] flex-col gap-3 px-5 pb-28',
        sun && 'travel-sun',
      )}
    >
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
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-title-2 font-bold">
            {n ? t('travel.dayN', { n, date: formatMonthDay(today) }) : formatMonthDay(today)}
          </span>
          <span className="tabular text-caption text-fg-muted">
            {t('travel.localTime', { time: now })}
          </span>
        </span>
        <DayWeatherBadge weather={w} />
        <IconButton
          label={t('travel.sun')}
          aria-pressed={sun}
          icon={<Sun />}
          tone={sun ? 'tint' : 'plain'}
          onClick={() => setTravelPrefs({ sun: !sun, sunAsked: true })}
        />
        {/* 긴급 연락처는 늘 오른쪽 위 (D1, 인터넷 없어도) */}
        <IconButton
          label={t('emergency.title')}
          icon={<Siren />}
          tone="cancel"
          onClick={() => setSosOpen(true)}
        />
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
          <Button size="sm" variant="secondary" onClick={() => setTravelPrefs({ sunAsked: true })}>
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

      {/* 아침 브리핑 (A2): 첫 일정 전까지 */}
      {phase === 'morning' && (
        <section
          aria-label={t('travel.morning')}
          className="flex flex-col gap-1 rounded-card bg-bg-subtle p-4"
        >
          <span className="text-caption font-bold text-fg-muted">{t('travel.morning')}</span>
          <span className="text-body-1 font-semibold">
            {t('travel.briefing', { n: dayItems.length, time: firstTimed?.startTime ?? '' })}
          </span>
          {w && <span className="tabular text-caption text-fg-sub">{formatTemps(w)}</span>}
        </section>
      )}

      {current && (
        <div className="flex flex-col gap-1 rounded-card border border-line p-4">
          <span className="text-caption font-bold text-fg-muted">{t('travel.now')}</span>
          <span className="text-title-2 font-bold">{current.title}</span>
          {current.endTime && (
            <span className="tabular text-caption text-fg-sub">
              {t('travel.until', { time: current.endTime })}
            </span>
          )}
        </div>
      )}

      {/* 다음 일정: 나갈 시각이 가장 크게 (Q2) */}
      {next && leave && (
        <section
          aria-label={t('travel.next')}
          className="flex flex-col gap-1.5 rounded-card border border-primary/40 bg-primary-weak/40 p-4"
        >
          <span className="text-caption font-bold text-primary">
            {t(phase === 'morning' ? 'travel.first' : 'travel.next')}
          </span>
          <span className="text-body-1 font-semibold">
            {next.title} · {next.startTime}
          </span>
          <span className="tabular text-title-1 font-bold">
            {t(leave.inMin < 0 ? 'travel.leaveNow' : 'travel.leaveAt', { time: leave.at })}
          </span>
          <span className="tabular text-caption text-fg-sub">
            {[
              leave.inMin >= 0 && t('travel.leaveIn', { min: leave.inMin }),
              travelMin !== undefined &&
                t(eta?.transit ? 'travel.byTransit' : 'travel.byWalk', { min: travelMin }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {(next.place?.coords || next.place?.address || next.place?.name) && (
            <Button
              size="lg"
              fullWidth
              leading={<Navigation aria-hidden="true" className="size-5" />}
              onClick={() => go(next)}
            >
              {t('travel.directions')}
            </Button>
          )}
        </section>
      )}

      {/* 저녁 정리 + 내일 미리보기 (A5·A6, Q1) */}
      {phase === 'evening' && (
        <section
          aria-label={t('travel.evening')}
          className="flex flex-col gap-2 rounded-card bg-bg-subtle p-4"
        >
          <span className="text-caption font-bold text-fg-muted">{t('travel.evening')}</span>
          <span className="text-body-1 font-semibold">
            {t('travel.recap', { n: dayItems.length, done: visitedCount })}
          </span>
          <span className="border-t border-dashed border-line pt-2 text-caption font-bold text-fg-muted">
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
      )}

      {!current && !next && phase !== 'evening' && (
        <p className="rounded-card bg-bg-subtle p-4 text-body-2 text-fg-sub">{t('travel.empty')}</p>
      )}

      {/* 남은 일정 + 지난 일정 접기 (C3) */}
      {dayItems.length > 0 && (
        <section aria-label={t('travel.rest')} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <h2 className="text-caption font-bold text-fg-muted">
              {t('travel.restN', { n: restItems.length })}
            </h2>
            {pastItems.length > 0 && (
              <button
                type="button"
                aria-expanded={pastOpen}
                onClick={() => setPastOpen(!pastOpen)}
                className="flex h-9 items-center gap-1 text-caption font-semibold text-fg-sub"
              >
                {t('travel.pastN', { n: pastItems.length })}
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition-transform ${pastOpen ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>
          {pastOpen && pastItems.length > 0 && (
            <ul
              aria-label={t('travel.past')}
              className="flex flex-col divide-y divide-line rounded-card border border-dashed border-line"
            >
              {pastItems.map(row)}
            </ul>
          )}
          {restItems.length > 0 && (
            <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
              {restItems.map(row)}
            </ul>
          )}
        </section>
      )}

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

      {/* 엄지 버튼: 숙소로 길찾기 고정 + 시간대별 3칸 (Q3) */}
      <nav
        aria-label={t('travel.thumb')}
        className="fixed inset-x-0 bottom-0 mx-auto grid max-w-[560px] grid-cols-4 gap-2 border-t border-line bg-surface px-4 pt-2 pb-[calc(var(--safe-bottom,0px)+8px)]"
      >
        <button
          type="button"
          onClick={toStay}
          className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-btn bg-primary-weak text-micro font-semibold text-primary"
        >
          <Bed aria-hidden="true" className="size-5" />
          {t('travel.toStay')}
        </button>
        {THUMBS[phase].map(({ id, icon: Icon, path }) => (
          <button
            key={id}
            type="button"
            onClick={() => void navigate(path(trip.id))}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-btn bg-bg-subtle text-micro font-semibold"
          >
            <Icon aria-hidden="true" className="size-5 text-primary" />
            {t(`travel.thumbs.${id}`)}
          </button>
        ))}
      </nav>
      <QuickMenuButton inTrip />
      <DirectionsSheet
        open={dirOpen}
        onOpenChange={setDirOpen}
        destination={dest}
        isDomestic={domestic}
      />
      <EmergencySheet open={sosOpen} onOpenChange={setSosOpen} countries={countries} />
    </div>
  );
}
