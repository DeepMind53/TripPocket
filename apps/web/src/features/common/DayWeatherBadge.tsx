import { formatTemps, weatherLook } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { WeatherIcon } from '../../shared/ui';
import type { TripDayWeather } from './useTripWeather';

/** 날짜 머리글 오른쪽 날씨: 그림 + 최저/최고. 작년 기록이면 앞에 작은 글씨 "25년 정보" */
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
  return (
    <span role="img" aria-label={label} className="flex shrink-0 items-center gap-1">
      {weather.year && (
        <span aria-hidden="true" className="text-micro text-fg-muted">
          {t('weather.yearShort', { yy: String(weather.year).slice(2) })}
        </span>
      )}
      <WeatherIcon kind={look.kind} className="size-5" />
      <span aria-hidden="true" className="tabular text-caption text-fg-sub">
        {formatTemps(weather)}
      </span>
    </span>
  );
}
