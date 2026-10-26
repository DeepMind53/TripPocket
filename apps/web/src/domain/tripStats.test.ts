import type { Booking, ItineraryItem, Trip } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { travelStats } from './tripStats';

const base = { createdAt: '', updatedAt: '' };
const trip = (
  id: string,
  title: string,
  start: string,
  end: string,
  cc: string,
  lat: number,
  lng = 139.7,
) =>
  ({
    ...base,
    id,
    title,
    startDate: start,
    endDate: end,
    timezone: 'Asia/Tokyo',
    cover: {},
    destinations: [{ name: title, kind: 'city', countryCode: cc, coords: { lat, lng } }],
  }) as Trip;
const item = (
  id: string,
  tripId: string,
  order: string,
  lat: number,
  extra: Partial<ItineraryItem> = {},
) =>
  ({
    ...base,
    id,
    tripId,
    date: '2026-10-01',
    order,
    kind: 'food',
    title: id,
    place: { coords: { lat, lng: 139.7 } },
    ...extra,
  }) as ItineraryItem;

describe('travelStats', () => {
  const trips = [
    trip('t1', '도쿄', '2026-10-01', '2026-10-04', 'JP', 35.68),
    trip('t2', '오사카', '2026-09-01', '2026-09-02', 'JP', 34.69, 135.5),
  ];
  // 위도 0.01도 ≈ 1.1km (걷기), 0.05도 ≈ 5.6km (대중교통)
  const items = [
    item('a', 't1', 'a', 35.68),
    item('b', 't1', 'b', 35.69),
    item('c', 't1', 'c', 35.74, { kind: 'cafe' }),
    item('skip', 't1', 'd', 36.5, { visit: 'skipped' }),
    item('other', 'tX', 'a', 10),
  ];
  const bookings = [
    { ...base, id: 'f1', tripId: 't1', kind: 'flight', title: 'KE', start: { date: '2026-10-01' } },
    { ...base, id: 'f2', tripId: 't1', kind: 'flight', title: 'KE', start: { date: '2026-10-04' } },
    {
      ...base,
      id: 'h',
      tripId: 't1',
      kind: 'lodging',
      title: '호텔',
      start: { date: '2026-10-01' },
    },
  ] as Booking[];

  it('여행·일수·나라·종류·가장 긴 여행', () => {
    const s = travelStats(trips, items, bookings);
    expect(s).toMatchObject({
      trips: 2,
      days: 6,
      flights: 2,
      places: 3,
      topCountry: { code: 'JP', trips: 2 },
      topKind: { kind: 'food', count: 2 },
      longest: { title: '도쿄', days: 4 },
    });
    expect(s.farthest?.title).toBe('도쿄');
  });

  it('2km 안은 걷기, 먼 곳은 대중교통, 미방문·다른 여행은 뺀다', () => {
    const s = travelStats(trips, items, bookings);
    expect(s.walkKm).toBeCloseTo(1.1, 1);
    expect(s.transitKm).toBeCloseTo(5.6, 0);
  });

  it('다녀온 여행이 없으면 0', () => {
    expect(travelStats([], items, bookings)).toMatchObject({ trips: 0, walkKm: 0, flights: 0 });
  });

  it('숙박·이른/늦은 일정·가장 바쁜 날·카페·맛집·국내외·올해', () => {
    const more = [
      ...items,
      item('d', 't1', 'e', 35.7, { startTime: '06:30' }),
      item('e', 't1', 'f', 35.7, { startTime: '22:10', kind: 'cafe' }),
    ];
    const lodging = [
      ...bookings,
      {
        ...base,
        id: 'h2',
        tripId: 't1',
        kind: 'lodging',
        title: '호텔',
        start: { date: '2026-10-01' },
        end: { date: '2026-10-04' },
      },
    ] as Booking[];
    const s = travelStats(trips, more, lodging, '2026-10-27');
    expect(s).toMatchObject({
      nights: 3,
      earliest: '06:30',
      latest: '22:10',
      busiestDay: { date: '2026-10-01', count: 5 },
      cafes: 2,
      restaurants: 3,
      overseas: 2,
      domestic: 0,
      thisYear: 2,
    });
  });
});
