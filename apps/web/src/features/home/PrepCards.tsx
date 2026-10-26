import {
  COUNTRY_CURRENCY,
  daysUntil,
  HUNDRED_UNIT,
  todayIn,
  type FxSnapshot,
  type Trip,
} from '@trippocket/shared';
import { ChevronDown, Sparkles } from 'lucide-react';

/** 준비 현황 펼침 상태 (이 기기) */
const OPEN_KEY = 'tp-prep-open';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useChecklist, useTripBookings } from '../../data/hooks';
import { cachedFx } from '../../data/services/fxService';
import {
  countWeatherKinds,
  formatForecastDate,
  formatTemps,
  weatherLook,
} from '../../domain/weather';
import { useTripWeather } from '../common/useTripWeather';
import { useEssentials } from '../essentials/useEssentials';
import { useTripAlerts } from '../weather/useTripAlerts';
import { topLevel } from '../../domain/alerts';
import { useTranslation } from '../../i18n';
import { WeatherIcon } from '../../shared/ui';

/**
 * 여행 전 홈 "준비 현황" (docs/16 B1, 사용자 결정 2026-10-24: 4장 + AI 추천 버튼).
 * 출발 30일 전부터. 모두 기기에 있는 값(준비물·예약·저장해 둔 환율)과 날씨 예보(3시간 저장)만 — 새 외부 호출은 날씨뿐.
 * 할 일 표시(주황 점): 숙소 예약 없음 / 준비물 없음 / 출발 3일 전인데 준비물이 남음
 */
export function PrepCards({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const bookings = useTripBookings(trip.id) ?? [];
  const packing = useChecklist(trip.id, 'packing');
  // 달력과 같은 예보(2주 안), 그보다 먼 날은 작년 같은 날 기록
  const tripWeather = useTripWeather(trip);
  const weather = tripWeather[trip.startDate];
  // 예보가 나온 날만 모아 "맑음 3일 · 비 1일" (사용자 요청 2026-10-26)
  const forecastKinds = countWeatherKinds(Object.values(tripWeather).filter((w) => !w.year));
  const essentials = useEssentials(trip);
  const [fx, setFx] = useState<FxSnapshot | null>(null);
  const daysLeft = daysUntil(trip.startDate, todayIn(trip.timezone));
  // 출발 7일 전부터 여행지 특보(빨강·주황) 점 (docs/24 §2-2)
  const alerts = useTripAlerts(trip, daysLeft <= 7);
  const alertLevel = topLevel(alerts);
  const currency = trip.destinations
    .map((d) => (d.countryCode ? COUNTRY_CURRENCY[d.countryCode] : undefined))
    .find((c) => c && c !== 'KRW');

  useEffect(() => {
    void cachedFx().then(setFx);
  }, []);

  const live = bookings.filter((b) => !b.deletedAt);
  const flights = live.filter((b) => b.kind === 'flight').length;
  const lodgings = live.filter((b) => b.kind === 'lodging').length;
  const packed = (packing ?? []).filter((p) => p.checked).length;
  const total = packing?.length ?? 0;
  const base = `/trips/${trip.id}`;
  const rate = currency ? fx?.rates[currency] : undefined;
  const unit = currency && HUNDRED_UNIT.has(currency) ? 100 : 1;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleOpen = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem(OPEN_KEY, v ? '1' : '0');
    } catch {
      // 기억 못 해도 이번에는 적용
    }
  };
  const anyAlert =
    lodgings === 0 ||
    (packing !== undefined && (total === 0 || (daysLeft <= 3 && packed < total))) ||
    !!essentials?.alert;

  return (
    <section aria-label={t('prep.title')} className="flex flex-col gap-2">
      {/* 기본은 한 줄 요약, 누르면 펼침 (docs/20 U3) — 펼침 상태는 이 기기에 기억 */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => toggleOpen(!open)}
        className="tabular flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-2.5 text-left"
      >
        <span className="shrink-0 text-caption font-bold text-fg-muted">{t('prep.title')}</span>
        <span className="min-w-0 flex-1 truncate text-caption text-fg-sub">
          🧳 {packed}/{total} · 🎫 {t('prep.bookingCounts', { flights, lodgings })}
          {essentials && essentials.total > 0 && ` · 🛂 ${essentials.done}/${essentials.total}`}
        </span>
        {anyAlert && (
          <span
            role="img"
            aria-label={t('prep.needsAttention')}
            className="size-2 shrink-0 rounded-full bg-warning"
          />
        )}
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Card
              to={`${base}/checklist`}
              emoji="🧳"
              label={t('prep.packing')}
              alert={packing !== undefined && (total === 0 || (daysLeft <= 3 && packed < total))}
            >
              {total === 0 ? (
                <span className="text-caption text-fg-muted">{t('prep.packingEmpty')}</span>
              ) : (
                <>
                  <span className="tabular text-body-1 font-bold">
                    {packed}/{total}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((packed / total) * 100)}%` }}
                    />
                  </span>
                </>
              )}
            </Card>
            <Card
              to={`${base}/bookings`}
              emoji="🎫"
              label={t('prep.bookings')}
              alert={lodgings === 0}
            >
              <span className="text-body-2">{t('prep.bookingCounts', { flights, lodgings })}</span>
              {lodgings === 0 && (
                <span className="text-caption text-warning">{t('prep.noLodging')}</span>
              )}
            </Card>
            <Card
              to={`${base}/weather`}
              emoji="☀️"
              label={t('prep.weather')}
              alert={alertLevel ?? false}
              alertLabel={alertLevel ? t('alerts.homeDot', { n: alerts.length }) : undefined}
            >
              {weather ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <WeatherIcon kind={weatherLook(weather.code).kind} className="size-6" />
                    <span className="text-caption text-fg-sub">
                      {weatherLook(weather.code).label}
                    </span>
                    <span className="tabular text-body-2">{formatTemps(weather)}</span>
                  </span>
                  {weather.year ? (
                    <span className="text-micro text-fg-muted">
                      {t('prep.weatherPast', { yy: String(weather.year).slice(2) })}
                    </span>
                  ) : (
                    <>
                      <span className="tabular text-micro text-fg-muted">
                        {t('prep.weatherForecast', { date: formatForecastDate(trip.startDate) })}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {forecastKinds.map(({ kind, label, days }) => (
                          <span
                            key={kind}
                            role="img"
                            aria-label={t('prep.weatherDaysLabel', {
                              look: label,
                              n: days,
                            })}
                            className="tabular flex items-center gap-0.5 text-caption text-fg-sub"
                          >
                            <WeatherIcon kind={kind} className="size-4" />
                            {t('prep.weatherDays', { n: days })}
                          </span>
                        ))}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-caption text-fg-muted">
                  {daysLeft >= 14 ? t('prep.weatherLater') : t('prep.weatherNone')}
                </span>
              )}
            </Card>
            <Card to={`/fx?trip=${trip.id}`} emoji="💱" label={t('prep.fx')}>
              {currency && rate ? (
                <span className="tabular text-body-2">
                  {t('prep.fxValue', {
                    unit,
                    code: currency,
                    won: (rate * unit).toLocaleString('ko-KR', { maximumFractionDigits: 2 }),
                  })}
                </span>
              ) : (
                <span className="text-caption text-fg-muted">{t('prep.fxOpen')}</span>
              )}
            </Card>
          </div>
          {/* 나라별 필수 항목 (docs/19) — 가로 전체 칸 */}
          {essentials && essentials.total > 0 && (
            <Link
              to={`/trips/${trip.id}/essentials`}
              className="relative flex flex-col gap-1 rounded-card border border-line bg-surface p-3"
            >
              <span className="flex items-center gap-1.5 text-caption font-semibold text-fg-sub">
                <span aria-hidden="true">🛂</span>
                {t('essentials.title')}
                <span className="tabular ml-auto pr-4 text-body-2 font-bold text-fg">
                  {essentials.done}/{essentials.total}
                </span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((essentials.done / essentials.total) * 100)}%` }}
                />
              </span>
              <span className="truncate text-caption text-fg-muted">
                {essentials.next
                  ? t('essentials.next', { title: essentials.next.item.title })
                  : t('essentials.allDone')}
              </span>
              {essentials.alert && (
                <span
                  role="img"
                  aria-label={t('prep.needsAttention')}
                  className="absolute top-3 right-3 size-2 rounded-full bg-warning"
                />
              )}
            </Link>
          )}
          <Link
            to={`/ai?trip=${trip.id}`}
            className="flex h-12 items-center justify-center gap-2 rounded-card bg-primary-weak text-body-2 font-semibold text-primary"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {t('prep.ai', { place: trip.destinations[0]?.name ?? trip.title })}
          </Link>
        </>
      )}
    </section>
  );
}

function Card({
  to,
  emoji,
  label,
  alert = false,
  alertLabel,
  children,
}: {
  to: string;
  emoji: string;
  label: string;
  /** true = 할 일(주황 점), 'red'·'orange' = 여행지 특보 등급 점 */
  alert?: boolean | 'red' | 'orange';
  alertLabel?: string | undefined;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Link
      to={to}
      className="relative flex min-h-24 flex-col gap-1.5 rounded-card border border-line bg-surface p-3"
    >
      <span className="flex items-center gap-1.5 text-caption font-semibold text-fg-sub">
        <span aria-hidden="true">{emoji}</span>
        {label}
      </span>
      {children}
      {alert && (
        <span
          role="img"
          aria-label={alertLabel ?? t('prep.needsAttention')}
          className={
            alert === 'red'
              ? 'absolute top-3 right-3 size-2.5 animate-pulse rounded-full bg-danger'
              : 'absolute top-3 right-3 size-2 rounded-full bg-warning'
          }
        />
      )}
    </Link>
  );
}
