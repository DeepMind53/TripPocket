import { formatTemps, weatherLook } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { RollingSlot, WeatherIcon } from '../../shared/ui';
import type { TripDayWeather } from './useTripWeather';

/**
 * 날짜 머리글 오른쪽 날씨: 그림 + 최저/최고. 작년 기록이면 "과거 날씨" (사용자 요청 2026-10-26).
 * "과거 날씨" ↔ 그림·기온을 한 칸에서 번갈아 — "1일차" ↔ 날짜처럼, 칸 폭은 넓은 쪽에 고정 (사용자 요청 2026-11-23)
 */
export function DayWeatherBadge({ weather }: { weather: TripDayWeather | undefined }) {
  const { t } = useTranslation();
  if (!weather) return null;
  const look = weatherLook(weather.code);
  const label = weather.year
    ? t('weather.lastYearLabel', {
        year: weather.year,
        look: look.label,
        temps: formatTemps(weather),
      })
    : t('weather.forecastLabel', { look: look.label, temps: formatTemps(weather) });
  const info = (
    <span className="flex items-center gap-1">
      <WeatherIcon kind={look.kind} className="size-5" />
      <span className="tabular text-caption text-fg-sub">{formatTemps(weather)}</span>
    </span>
  );
  return (
    <span role="img" aria-label={label} className="flex shrink-0 items-center">
      {weather.year ? (
        <span aria-hidden="true" className="flex">
          <RollingSlot
            reserve
            items={[
              <span key="past" className="text-caption whitespace-nowrap text-fg-muted">
                {t('weather.pastShort')}
              </span>,
              <span key="info">{info}</span>,
            ]}
          />
        </span>
      ) : (
        <span aria-hidden="true" className="flex">
          {info}
        </span>
      )}
    </span>
  );
}
