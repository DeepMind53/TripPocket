import { formatTemps, weatherLook } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { RollingSlot, WeatherIcon } from '../../shared/ui';
import type { TripDayWeather } from './useTripWeather';

/**
 * 날짜 머리글 오른쪽 날씨: 그림 + 최저/최고. 작년 기록이면 "과거 날씨" (사용자 요청 2026-10-26).
 * "과거 날씨" ↔ 그림·기온을 한 칸에서 번갈아 — "1일차" ↔ 날짜처럼, 칸 폭은 넓은 쪽에 고정 (사용자 요청 2026-11-23)
 *
 * `part`: 이미 바깥 전광판(날씨·오늘·Plan B) 안에 있으면 따로 굴리지 않고 조각만 넘겨
 * 바깥 목록에 펼쳐 넣는다 — 두 전광판이 같은 박자로 돌면 기온이 영원히 숨는다 (docs/31 §11 R2)
 */
export function DayWeatherBadge({
  weather,
  part,
}: {
  weather: TripDayWeather | undefined;
  /** 'past' = "과거 날씨" 글자만(스크린리더는 'info'가 읽음), 'info' = 그림·기온만 */
  part?: 'past' | 'info';
}) {
  const { t } = useTranslation();
  if (!weather) return null;
  if (part === 'past')
    return (
      <span aria-hidden="true" className="text-caption whitespace-nowrap text-fg-muted">
        {t('weather.pastShort')}
      </span>
    );
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
      {weather.year && !part ? (
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
