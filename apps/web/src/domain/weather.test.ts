import { describe, expect, it } from 'vitest';
import { countWeatherKinds, formatForecastDate, hourWeather } from './weather';

describe('countWeatherKinds', () => {
  it('counts days per weather kind, most days first', () => {
    const w = (code: number) => ({ code, min: 10, max: 20 });
    expect(countWeatherKinds([w(61), w(0), w(0), w(2), w(0), w(63)])).toEqual([
      { kind: 'sun', label: '맑음', days: 3 },
      { kind: 'rain', label: '비', days: 2 },
      { kind: 'partly', label: '구름 조금', days: 1 },
    ]);
  });

  it('is empty without days', () => {
    expect(countWeatherKinds([])).toEqual([]);
  });
});

describe('formatForecastDate', () => {
  it('formats YY.MM/DD', () => {
    expect(formatForecastDate('2026-11-12')).toBe('26.11/12');
  });
});

it('그 시각 예보: 시간별 예보가 있으면 그 시, 없으면 null', () => {
  const w = {
    code: 3,
    min: 10,
    max: 18,
    hours: {
      code: Array.from({ length: 24 }, (_, h) => (h === 14 ? 61 : 3)),
      temp: Array.from({ length: 24 }, (_, h) => h + 0.4),
    },
  };
  expect(hourWeather(w, '14:30')).toEqual({ code: 61, temp: 14 });
  expect(hourWeather({ code: 3, min: 10, max: 18 }, '14:30')).toBeNull();
  expect(hourWeather(w, undefined)).toBeNull();
});
