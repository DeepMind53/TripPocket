/**
 * WMO 날씨 코드(Open-Meteo) → 그림 종류·한국어 (https://open-meteo.com/en/docs 의 weather_code 표)
 */
export type WeatherKind =
  'sun' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' | 'unknown';

export interface WeatherLook {
  kind: WeatherKind;
  label: string;
}

export function weatherLook(code: number): WeatherLook {
  if (code === 0) return { kind: 'sun', label: '맑음' };
  if (code === 1 || code === 2) return { kind: 'partly', label: '구름 조금' };
  if (code === 3) return { kind: 'cloud', label: '흐림' };
  if (code === 45 || code === 48) return { kind: 'fog', label: '안개' };
  if (code >= 51 && code <= 57) return { kind: 'drizzle', label: '이슬비' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { kind: 'rain', label: '비' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { kind: 'snow', label: '눈' };
  if (code >= 95) return { kind: 'storm', label: '뇌우' };
  return { kind: 'unknown', label: '날씨' };
}

export interface DayWeather {
  code: number;
  min: number;
  max: number;
}

/** "12°/20°" (반올림) */
export function formatTemps(w: DayWeather): string {
  return `${Math.round(w.min)}°/${Math.round(w.max)}°`;
}

/** 여행 기간 날씨 요약 "맑음 3일 · 비 1일" — 많은 날 순, 같으면 먼저 나온 날씨 순 */
export function countWeatherKinds(days: readonly DayWeather[]): (WeatherLook & { days: number })[] {
  const counts = new Map<WeatherKind, WeatherLook & { days: number }>();
  for (const d of days) {
    const look = weatherLook(d.code);
    const c = counts.get(look.kind);
    if (c) c.days += 1;
    else counts.set(look.kind, { ...look, days: 1 });
  }
  return [...counts.values()].sort((a, b) => b.days - a.days);
}

/** 날짜 "2026-11-12" → "26.11/12" (홈 날씨 카드, 사용자 요청 2026-10-26) */
export function formatForecastDate(date: string): string {
  return `${date.slice(2, 4)}.${date.slice(5, 7)}/${date.slice(8, 10)}`;
}

/** 날씨 주의 (2026-10-28 정식, 사용자 요청): 일정 시간 아래 이모지. 여러 개면 모두 */
export type WeatherCaution = 'rain' | 'storm' | 'snow' | 'fog' | 'cold' | 'freezing' | 'hot';
export const CAUTION_EMOJI: Record<WeatherCaution, string> = {
  rain: '☔',
  storm: '⛈️',
  snow: '❄️',
  fog: '🌫️',
  cold: '🧥',
  freezing: '🧤',
  hot: '🥵',
};
/** 비·뇌우·눈·안개 + 최저 10° 이하(겉옷)·0° 이하(장갑)·최고 30° 이상(더위) */
export function weatherCautions(w: DayWeather): WeatherCaution[] {
  const out: WeatherCaution[] = [];
  const kind = weatherLook(w.code).kind;
  if (kind === 'rain' || kind === 'drizzle') out.push('rain');
  if (kind === 'storm') out.push('storm');
  if (kind === 'snow') out.push('snow');
  if (kind === 'fog') out.push('fog');
  if (w.min <= 10) out.push('cold');
  if (w.min <= 0) out.push('freezing');
  if (w.max >= 30) out.push('hot');
  return out;
}
