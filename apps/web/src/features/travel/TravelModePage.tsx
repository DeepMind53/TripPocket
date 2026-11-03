import { addDays, dayNumberOf, todayIn, type ItineraryItem, type Trip } from '@trippocket/shared';
import { Bed, Bell, BellOff, House, Navigation, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTrip, useTripBookings, useTripItems } from '../../data/hooks';
import { itemRepo } from '../../data/repositories/itemRepo';
import { setTravelMode, setTravelPrefs, useTravelMode } from '../../data/travelModeStore';
import { airWarnings } from '../../domain/air';
import { currentItemId, nextStop } from '../../domain/dayTools';
import { lodgingForNight } from '../../domain/lodging';
import { isDomesticTrip } from '../../domain/tripPlace';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { cn } from '../../shared/lib/cn';
import { timeIn, useMinuteClock } from '../../shared/hooks/useMinuteClock';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { Button, IconButton, Skeleton, toast } from '../../shared/ui';
import type { Destination } from '../../shared/lib/directions';
import { DirectionsSheet } from '../common/DirectionsSheet';
import { DayWeatherBadge } from '../common/DayWeatherBadge';
import { openDirectionsDirect } from '../common/openDirections';
import { QuickMenuButton } from '../common/QuickMenu';
import { SHORTCUT_ICON, shortcutPath, useQuickShortcuts } from '../common/quickShortcuts';
import { useTripWeather } from '../common/useTripWeather';
import { useTripPlanItems } from '../itinerary/usePlanView';

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * 여행 모드 (실험실, docs/25 1단계 + 추천안 D1~D6, 2026-11-03):
 * 고치는 기능 없이 오늘·내일만 — 지금·다음 일정(길찾기 한 번), 남은 일정(방문 표시는 됨, D5),
 * 엄지 버튼(빠른 메뉴 바로가기와 같은 목록, D4), 햇빛 모드·출발 10분 전 알림(D3). [편집]이면 일반 화면으로
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
  const { sun, remind } = useTravelMode();
  // 일정은 [홈]과, 숙소로 길찾기는 맨 앞 버튼과 같아 뺀다 (2026-11-03)
  const ids = useQuickShortcuts((s) => s.ids).filter((id) => id !== 'plan' && id !== 'lodging');
  const [dirOpen, setDirOpen] = useRouteSheet('travel-directions');
  const [dest, setDest] = useState<Destination | null>(null);
  const [, openQuick] = useRouteSheet('quick-menu');
  const today = todayIn(trip.timezone);
  const [tab, setTab] = useState<'today' | 'tomorrow'>('today');
  const date = tab === 'today' ? today : addDays(today, 1);
  const clock = useMinuteClock(true);
  const now = timeIn(trip.timezone, clock) ?? '00:00';
  const dayItems = items.filter((i) => i.date === date && i.kind !== 'note');
  const nowId = tab === 'today' ? currentItemId(dayItems, now) : null;
  const current = dayItems.find((i) => i.id === nowId);
  const next = tab === 'today' ? nextStop(dayItems, now) : (dayItems[0] ?? null);
  const n = dayNumberOf(trip.startDate, trip.endDate, date);
  const domestic = isDomesticTrip(trip);
  // 오늘 밤 숙소 → 없으면 첫 숙소 (빠른 메뉴 "숙소로 길찾기"와 같은 규칙)
  const stay =
    lodgingForNight(bookings, date)?.booking ?? bookings.find((b) => b.kind === 'lodging');
  const leaveIn = next?.startTime && tab === 'today' ? mins(next.startTime) - mins(now) : null;

  // 출발 10분 전 알림 (앱이 열려 있을 때 — 브라우저 알림 권한을 허락한 경우)
  useEffect(() => {
    if (!remind || leaveIn == null || leaveIn < 0 || !next) return;
    const ms = Math.max(0, (leaveIn - 10) * 60_000);
    const timer = window.setTimeout(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification(t('travel.remindTitle'), { body: next.title });
      navigator.vibrate?.(200);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [remind, leaveIn, next, t]);

  // 길찾기 앱을 바로 열고, "매번 묻기"면 고르는 시트
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

  const card = (label: string, i: ItineraryItem, extra?: string) => (
    <div className="flex flex-col gap-2 rounded-card border border-primary/40 bg-primary-weak/40 p-4">
      <span className="text-caption font-bold text-primary">{label}</span>
      <span className="text-title-2 font-bold">{i.title}</span>
      <span className="tabular text-body-2 text-fg-sub">
        {[i.startTime && `${i.startTime}${i.endTime ? `–${i.endTime}` : ''}`, extra]
          .filter(Boolean)
          .join(' · ')}
      </span>
      {(i.place?.coords || i.place?.address || i.place?.name) && (
        <Button
          size="lg"
          fullWidth
          leading={<Navigation aria-hidden="true" className="size-5" />}
          onClick={() => go(i)}
        >
          {t('travel.directions')}
        </Button>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 px-5 pt-4 pb-28',
        sun && 'travel-sun',
      )}
    >
      <header className="flex items-center gap-2">
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
          <span className="text-title-2 font-bold">
            {n ? t('travel.dayN', { n, date: formatMonthDay(date) }) : formatMonthDay(date)}
          </span>
          <span className="tabular text-caption text-fg-muted">
            {t('travel.localTime', { time: now })}
          </span>
        </span>
        <DayWeatherBadge weather={weather[date]} />
        <Button
          size="sm"
          variant={sun ? 'primary' : 'secondary'}
          aria-pressed={sun}
          aria-label={t('travel.sun')}
          onClick={() => setTravelPrefs({ sun: !sun })}
        >
          <Sun aria-hidden="true" className="size-4" />
        </Button>
      </header>
      {airWarnings(weather[date]?.air).map((w) => (
        <p
          key={w.key}
          className="rounded-btn bg-warning/10 px-3 py-2 text-caption whitespace-pre-line"
        >
          {t(`air.${w.key}`, { v: w.v })}
        </p>
      ))}

      <div role="tablist" className="grid grid-cols-2 gap-2">
        {(['today', 'tomorrow'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              'h-11 rounded-btn border text-body-1 font-semibold',
              tab === k ? 'border-primary bg-primary text-on-primary' : 'border-line',
            )}
          >
            {t(`travel.${k}`)}
          </button>
        ))}
      </div>

      {current && card(t('travel.now'), current)}
      {next &&
        card(
          t(tab === 'today' ? 'travel.next' : 'travel.first'),
          next,
          leaveIn != null && leaveIn >= 0 ? t('travel.leaveIn', { min: leaveIn }) : undefined,
        )}
      {!current && !next && (
        <p className="rounded-card bg-bg-subtle p-4 text-body-2 text-fg-sub">{t('travel.empty')}</p>
      )}

      {dayItems.length > 0 && (
        <section aria-label={t('travel.rest')} className="flex flex-col gap-1.5">
          <h2 className="text-caption font-bold text-fg-muted">{t('travel.rest')}</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
            {dayItems.map((i) => (
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
                {tab === 'today' && i.startTime && i.startTime <= now && !i.visit && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void itemRepo.setVisit(i.id, 'visited')}
                  >
                    {t('travel.visited')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
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

      {/* 엄지 버튼: 숙소로 길찾기 + 빠른 메뉴 바로가기와 같은 목록 (D4) */}
      <nav
        aria-label={t('travel.thumb')}
        className="fixed inset-x-0 bottom-0 mx-auto grid max-w-[560px] grid-cols-3 gap-2 border-t border-line bg-surface px-4 pt-2 pb-[calc(var(--safe-bottom,0px)+8px)]"
      >
        <button
          type="button"
          onClick={toStay}
          className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-btn bg-primary-weak text-caption font-semibold text-primary"
        >
          <Bed aria-hidden="true" className="size-5" />
          {t('travel.toStay')}
        </button>
        {ids.slice(0, 5).map((id) => {
          const Icon = SHORTCUT_ICON[id];
          const path = shortcutPath(id, trip.id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => (path ? void navigate(path) : openQuick(true))}
              className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-btn bg-bg-subtle text-caption font-semibold"
            >
              <Icon aria-hidden="true" className="size-5" />
              {t(`quickMenu.shortcut.${id}` as 'quickMenu.shortcut.plan')}
            </button>
          );
        })}
      </nav>
      <QuickMenuButton inTrip />
      <DirectionsSheet
        open={dirOpen}
        onOpenChange={setDirOpen}
        destination={dest}
        isDomestic={domestic}
      />
    </div>
  );
}
