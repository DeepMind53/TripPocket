import {
  addDays,
  alertQuery,
  findAirport,
  getTripDays,
  type Booking,
  type LocalDate,
} from '@trippocket/shared';
import { SafetyNotices } from './SafetyNotices';
import { CircleHelp, Plane } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { useTrip, useTripBookings } from '../../data/hooks';
import { formatTemps, weatherLook } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BottomSheet, IconButton, TopBar, WeatherIcon, toast } from '../../shared/ui';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { WeatherKindBadge } from './WeatherKindBadge';
import { KIND_ICON, weatherKind, type WeatherKind } from './weatherKind';
import { useWeatherDays, type TripDayWeather } from '../common/useTripWeather';
import { DestinationAlerts } from './DestinationAlerts';

/**
 * 날씨 정보 (사용자 요청 2026-10-26): 홈 "날씨 정보" 카드를 누르면.
 * 여행 날짜와 앞뒤 하루씩 목적지 날씨 + 항공편마다 출발 공항의 그날 날씨.
 * 2주 안은 예보, 그보다 먼 날은 작년 같은 날 기록 (Open-Meteo, 좌표·날짜만 보냄)
 */
export function WeatherPage() {
  const { t } = useTranslation();
  const { tripId } = useParams();
  const trip = useTrip(tripId);
  const bookings = useTripBookings(tripId) ?? [];
  const dest = trip?.destinations.find((d) => d.coords);
  const dates = trip
    ? [
        addDays(trip.startDate, -1),
        ...getTripDays(trip.startDate, trip.endDate),
        addDays(trip.endDate, 1),
      ]
    : [];
  const weather = useWeatherDays(dest?.coords, trip?.timezone ?? 'Asia/Seoul', dates);
  const flights = bookings.filter((b) => b.kind === 'flight' && b.start.place);
  const { countries, points } = alertQuery(trip ?? { destinations: [] });
  const [help, setHelp] = useState(false);
  // 날짜를 누르면 그날 시간대별 날씨 (사용자 요청 2026-11-04)
  const [hourDate, setHourDate] = useState<LocalDate | null>(null);
  const [hourOpen, setHourOpen] = useRouteSheet('weather-hours');
  if (!trip) return null;

  const label = (i: number) =>
    i === 0
      ? t('weatherPage.dayBefore')
      : i === dates.length - 1
        ? t('weatherPage.dayAfter')
        : t('weatherPage.dayN', { n: i });

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      {/* 날씨 종류 설명은 제목 옆 ? 버튼으로 (사용자 요청 2026-11-02) */}
      <TopBar
        title={t('weatherPage.title')}
        backTo="/"
        actions={
          <IconButton
            label={t('weatherPage.help')}
            icon={<CircleHelp />}
            onClick={() => setHelp(true)}
          />
        }
      />
      <div className="flex flex-col gap-5 px-5 pt-2">
        <DestinationAlerts countries={countries} points={points} />
        <SafetyNotices countries={countries} />
        <section
          aria-label={t('weatherPage.dest', { place: dest?.name ?? trip.title })}
          className="flex flex-col gap-2"
        >
          <h2 className="text-caption font-semibold text-fg-muted">
            {t('weatherPage.dest', { place: dest?.name ?? trip.title })}
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
            {dates.map((d, i) => (
              <DayRow
                key={d}
                title={label(i)}
                date={d}
                weather={weather[d]}
                outside={i === 0 || i === dates.length - 1}
                onOpen={() => {
                  if (!weather[d]?.hours) return toast(t('weatherPage.noHours'));
                  setHourDate(d);
                  setHourOpen(true);
                }}
              />
            ))}
          </ul>
        </section>

        {flights.length > 0 && (
          <section aria-label={t('weatherPage.airports')} className="flex flex-col gap-2">
            <h2 className="text-caption font-semibold text-fg-muted">
              {t('weatherPage.airports')}
            </h2>
            <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
              {flights.map((b) => (
                <FlightWeather key={b.id} flight={b} />
              ))}
            </ul>
          </section>
        )}
      </div>
      <BottomSheet
        open={hourOpen && !!hourDate}
        onOpenChange={setHourOpen}
        title={hourDate ? t('weatherPage.hoursTitle', { date: formatMonthDay(hourDate) }) : ''}
        autoFocusInput={false}
      >
        {hourDate && weather[hourDate]?.hours && <HourList hours={weather[hourDate].hours} />}
      </BottomSheet>
      <BottomSheet
        open={help}
        onOpenChange={setHelp}
        title={t('weatherPage.help')}
        autoFocusInput={false}
      >
        <ul className="flex flex-col gap-3 pb-2">
          {(['observed', 'forecast', 'lastYear'] as WeatherKind[]).map((k) => {
            const { Icon, color } = KIND_ICON[k];
            return (
              <li key={k} className="flex items-start gap-3">
                <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${color}`} />
                <span className="flex flex-col">
                  <span className="text-body-2 font-semibold">{t(`weatherPage.kind.${k}`)}</span>
                  <span className="text-caption whitespace-pre-line text-fg-sub">
                    {t(`weatherPage.kindDesc.${k}`)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-micro text-fg-muted">{t('weatherPage.source')}</p>
      </BottomSheet>
    </div>
  );
}

function DayRow({
  title,
  date,
  weather,
  outside = false,
  onOpen,
}: {
  title: string;
  date: LocalDate;
  weather: TripDayWeather | undefined;
  outside?: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const look = weather ? weatherLook(weather.code) : null;
  return (
    <li className={outside ? 'bg-bg-subtle/60' : undefined}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('weatherPage.openHours', { date: formatMonthDay(date) })}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className="flex w-20 shrink-0 flex-col">
          <span className="text-caption font-semibold text-fg-sub">{title}</span>
          <span className="tabular text-body-2">{formatMonthDay(date)}</span>
        </span>
        {weather && look ? (
          <>
            {/* 예보·지난 날씨·작년 기록은 날짜와 날씨 그림 사이에 (사용자 요청 2026-11-03) */}
            <span className="shrink-0 whitespace-nowrap">
              <WeatherKindBadge kind={weatherKind(weather)} />
            </span>
            <WeatherIcon kind={look.kind} className="size-7" />
            <span className="min-w-0 flex-1 text-body-2">{look.label}</span>
            <span className="tabular text-body-1 font-semibold">{formatTemps(weather)}</span>
          </>
        ) : (
          <span className="flex-1 text-caption text-fg-muted">{t('prep.weatherNone')}</span>
        )}
      </button>
    </li>
  );
}

/** 그날 시간대별 날씨 (0~23시, 지금 시각 이후 먼저 보이게 하지는 않고 하루 전체) */
function HourList({ hours }: { hours: { code: number[]; temp: number[] } }) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t('weatherPage.hoursList')} className="flex flex-col divide-y divide-line pb-2">
      {hours.code.map((code, h) => {
        const temp = hours.temp[h];
        if (code === undefined || temp === undefined) return null;
        const look = weatherLook(code);
        const wet =
          look.kind === 'rain' ||
          look.kind === 'drizzle' ||
          look.kind === 'storm' ||
          look.kind === 'snow';
        return (
          <li
            key={h}
            className={`flex min-h-11 items-center gap-3 px-1 ${wet ? 'bg-primary-weak/40' : ''}`}
          >
            <span className="tabular w-12 shrink-0 text-caption font-semibold text-fg-sub">
              {t('weatherPage.hour', { h })}
            </span>
            <WeatherIcon kind={look.kind} className="size-6 shrink-0" />
            <span className="min-w-0 flex-1 text-body-2">{look.label}</span>
            <span className="tabular text-body-2 font-semibold">{Math.round(temp)}°</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 항공편마다 출발 공항(출발일)·도착 공항(도착일) 날씨 (2026-10-27 사용자 요청: 편명·공항 코드가 잘리지 않게, 두 공항 모두).
 * 공항 목록에 좌표가 있는 공항만 날씨를 받는다
 */
function FlightWeather({ flight }: { flight: Booking }) {
  const { t } = useTranslation();
  const from = flight.start.place ? findAirport(flight.start.place) : undefined;
  const to = flight.end?.place ? findAirport(flight.end.place) : undefined;
  return (
    <li className="flex flex-col gap-1 px-4 py-2.5">
      <span className="flex flex-wrap items-center gap-x-1.5 text-body-2 font-semibold break-words">
        <Plane aria-hidden="true" className="size-4 shrink-0 text-primary" />
        {flight.title}
        {/* 제목에 이미 공항 코드가 있으면(예: "IT603 ICN→TPE") 경로를 다시 쓰지 않는다 (2026-10-27) */}
        {(from || flight.start.place) &&
          !flight.title
            .toUpperCase()
            .includes((from?.iata ?? flight.start.place ?? '').toUpperCase()) && (
            <span className="tabular font-normal text-fg-sub">
              {from?.iata ?? flight.start.place}
              {flight.end?.place ? ` → ${to?.iata ?? flight.end.place}` : ''}
            </span>
          )}
      </span>
      <AirportDay
        role={t('weatherPage.depart')}
        place={flight.start.place}
        date={flight.start.date}
        time={flight.start.time}
        tz={flight.start.timezone}
      />
      {flight.end?.place && flight.end.date && (
        <AirportDay
          role={t('weatherPage.arrive')}
          place={flight.end.place}
          date={flight.end.date}
          time={flight.end.time}
          tz={flight.end.timezone}
        />
      )}
    </li>
  );
}

function AirportDay({
  role,
  place,
  date,
  time,
  tz,
}: {
  role: string;
  place: string | undefined;
  date: LocalDate;
  time?: string | undefined;
  tz?: string | undefined;
}) {
  const { t } = useTranslation();
  const airport = place ? findAirport(place) : undefined;
  const weather = useWeatherDays(airport?.coords, tz ?? 'Asia/Seoul', [date])[date];
  const look = weather ? weatherLook(weather.code) : null;
  return (
    <span className="flex items-center gap-3 pl-5.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption break-words text-fg-sub">
          <span className="font-semibold">{role}</span>{' '}
          {airport ? `${airport.name} (${airport.iata})` : place}
        </span>
        {/* 예보인지, 지난 기록인지, 작년 같은 날 기록인지 — 날짜·시각 오른쪽에 (2026-11-03) */}
        <span className="flex flex-wrap items-center gap-x-1.5">
          <span className="tabular text-micro text-fg-muted">
            {formatMonthDay(date)}
            {time ? ` ${time}` : ''}
          </span>
          {weather && (
            <span className="whitespace-nowrap">
              <WeatherKindBadge kind={weatherKind(weather)} />
            </span>
          )}
        </span>
      </span>
      {weather && look ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <WeatherIcon kind={look.kind} className="size-6" />
          <span className="tabular text-body-2 font-semibold">{formatTemps(weather)}</span>
        </span>
      ) : (
        <span className="shrink-0 text-caption text-fg-muted">{t('prep.weatherNone')}</span>
      )}
    </span>
  );
}
