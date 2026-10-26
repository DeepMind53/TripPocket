import { describe, expect, it } from 'vitest';
import { countWeatherKinds, formatForecastDate } from './weather';

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
