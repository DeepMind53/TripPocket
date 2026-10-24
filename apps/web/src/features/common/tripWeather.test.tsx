import { renderHook, waitFor } from '@testing-library/react';
import type { Trip } from '@trippocket/shared';
import { resetLocalDb } from '../../data/dev';
import { lastYearDate } from '../../data/services/travelInfo';
import { useTripWeather } from './useTripWeather';

const trip = {
  id: 't',
  title: '도쿄',
  timezone: 'Asia/Tokyo',
  destinations: [
    { name: '도쿄', kind: 'city', countryCode: 'JP', coords: { lat: 35.68, lng: 139.76 } },
  ],
  startDate: '2026-11-09',
  endDate: '2026-11-11',
  cover: {},
} as unknown as Trip;

let urls: string[] = [];
beforeEach(async () => {
  await resetLocalDb();
  urls = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-25T03:00:00Z'));
  vi.stubGlobal('fetch', (url: string) => {
    if (url.startsWith('/api/')) return Promise.resolve(Response.json({}));
    urls.push(url);
    if (url.includes('archive-api'))
      return Promise.resolve(
        Response.json({
          daily: {
            time: ['2025-11-10', '2025-11-11'],
            weather_code: [3, 61],
            temperature_2m_min: [9.4, 8],
            temperature_2m_max: [17.6, 14],
          },
        }),
      );
    return Promise.resolve(
      Response.json({
        daily: {
          time: ['2026-11-09'],
          weather_code: [0],
          temperature_2m_min: [10],
          temperature_2m_max: [19],
        },
      }),
    );
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('2주 안쪽은 예보, 그보다 먼 날은 작년 같은 날 기록 (해 표시)', async () => {
  const { result } = renderHook(() => useTripWeather(trip));
  await waitFor(() => expect(Object.keys(result.current)).toHaveLength(3));
  expect(result.current['2026-11-09']).toEqual({ code: 0, min: 10, max: 19 });
  expect(result.current['2026-11-10']).toEqual({ code: 3, min: 9.4, max: 17.6, year: 2025 });
  expect(result.current['2026-11-11']?.year).toBe(2025);
  const archive = urls.find((u) => u.includes('archive-api'))!;
  expect(archive).toContain('start_date=2025-11-10&end_date=2025-11-11');
});

it('작년 날짜: 2월 29일은 2월 28일로', () => {
  expect(lastYearDate('2028-02-29')).toBe('2027-02-28');
  expect(lastYearDate('2026-11-08')).toBe('2025-11-08');
});
