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

describe('지난 일정: 그해 그날 실제 날씨를 받아 저장 (사용자 요청 2026-11-23)', () => {
  const pastTrip = { ...trip, startDate: '2026-09-01', endDate: '2026-09-02' } as Trip;
  const archive = (days: string[]) =>
    vi.stubGlobal('fetch', (url: string) => {
      if (url.startsWith('/api/')) return Promise.resolve(Response.json({}));
      urls.push(url);
      return Promise.resolve(
        Response.json({
          daily: {
            time: days,
            weather_code: days.map(() => 61),
            temperature_2m_min: days.map(() => 21),
            temperature_2m_max: days.map(() => 27.4),
          },
        }),
      );
    });

  it('7일보다 오래된 날은 그 날짜 그대로 과거 기록을 받고 "지난 날씨"로, 다시 열면 저장한 것을 쓴다', async () => {
    archive(['2026-09-01', '2026-09-02']);
    const first = renderHook(() => useTripWeather(pastTrip));
    await waitFor(() => expect(Object.keys(first.result.current)).toHaveLength(2));
    expect(first.result.current['2026-09-01']).toEqual({
      code: 61,
      min: 21,
      max: 27.4,
      past: true,
    });
    // 작년이 아니라 그해 그날
    expect(urls.filter((u) => u.includes('archive-api'))).toEqual([
      expect.stringContaining('start_date=2026-09-01&end_date=2026-09-02'),
    ]);
    first.unmount();

    urls = [];
    const again = renderHook(() => useTripWeather(pastTrip));
    await waitFor(() => expect(Object.keys(again.result.current)).toHaveLength(2));
    expect(urls.filter((u) => u.includes('archive-api'))).toEqual([]);
  });

  it('과거 기록에 아직 빠진 날이 있으면 저장하지 않고 다음에 다시 받는다', async () => {
    archive(['2026-09-01']);
    const first = renderHook(() => useTripWeather(pastTrip));
    await waitFor(() => expect(Object.keys(first.result.current)).toHaveLength(1));
    first.unmount();
    urls = [];
    renderHook(() => useTripWeather(pastTrip));
    await waitFor(() => expect(urls.some((u) => u.includes('archive-api'))).toBe(true));
  });
});
