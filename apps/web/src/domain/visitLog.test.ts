import type { ItineraryItem, Trip } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { groupByCity, groupByPlace, groupByTrip, matchesVisit, visitCity } from './visitLog';

const tokyo = { lat: 35.68, lng: 139.76 };
const osaka = { lat: 34.69, lng: 135.5 };

const trip = (id: string, startDate: string, destinations: Trip['destinations']): Trip => ({
  id,
  title: `여행 ${id}`,
  timezone: 'Asia/Tokyo',
  cover: {},
  destinations,
  startDate,
  endDate: startDate,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  rev: 0,
});

let n = 0;
const item = (
  tripId: string,
  date: string,
  title: string,
  extra: Partial<ItineraryItem> = {},
): ItineraryItem => ({
  id: `i${++n}`,
  tripId,
  date,
  order: 'a0',
  kind: 'place',
  title,
  visit: 'visited',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  rev: 0,
  ...extra,
});

const two = trip('t1', '2025-05-01', [
  { name: '도쿄', kind: 'city', countryCode: 'JP', coords: tokyo },
  { name: '오사카', kind: 'city', countryCode: 'JP', coords: osaka },
]);

describe('visitCity', () => {
  it('목적지 도시가 하나면 그곳', () => {
    const one = trip('t', '2025-01-01', [{ name: '제주', kind: 'city', countryCode: 'KR' }]);
    expect(visitCity({ title: '성산일출봉' }, one)?.name).toBe('제주');
  });
  it('좌표가 있으면 가까운 도시 (80km 안)', () => {
    expect(
      visitCity({ title: '도톤보리', place: { coords: { lat: 34.67, lng: 135.5 } } }, two)?.name,
    ).toBe('오사카');
    expect(visitCity({ title: '먼 곳', place: { coords: { lat: 43, lng: 141 } } }, two)).toBeNull();
  });
  it('좌표가 없으면 주소에 나온 도시, 모르면 null', () => {
    expect(visitCity({ title: '라멘', place: { address: '도쿄 신주쿠구' } }, two)?.name).toBe(
      '도쿄',
    );
    expect(visitCity({ title: '어딘가' }, two)).toBeNull();
  });
  it('나라만 고른 여행은 도시를 모른다', () => {
    const country = trip('t', '2025-01-01', [{ name: '일본', kind: 'country', countryCode: 'JP' }]);
    expect(visitCity({ title: '센소지' }, country)).toBeNull();
  });
});

describe('matchesVisit', () => {
  const i = item('t1', '2025-05-01', '이치란 라멘', { memo: '줄 30분' });
  it('이름·메모·여행 제목·도시, 초성', () => {
    expect(matchesVisit('라멘', i, two, null)).toBe(true);
    expect(matchesVisit('ㄹㅁ', i, two, null)).toBe(true);
    expect(matchesVisit('줄', i, two, null)).toBe(true);
    expect(matchesVisit('여행 t1', i, two, null)).toBe(true);
    expect(matchesVisit('도쿄', i, two, { key: 'JP:도쿄', name: '도쿄' })).toBe(true);
    expect(matchesVisit('스시', i, two, null)).toBe(false);
    expect(matchesVisit('  ', i, two, null)).toBe(true);
  });
});

describe('묶기', () => {
  const later = trip('t2', '2025-09-01', [
    { name: '도쿄', kind: 'city', countryCode: 'JP', coords: tokyo },
  ]);
  const trips = new Map([
    ['t1', two],
    ['t2', later],
  ]);
  const a = item('t1', '2025-05-02', '센소지', { place: { coords: tokyo } });
  const b = item('t1', '2025-05-01', '오사카성', { place: { coords: osaka } });
  const c = item('t2', '2025-09-01', '센소지', { place: { coords: tokyo } });
  const d = item('t2', '2025-09-01', '미정 장소', { visit: 'skipped' });

  it('여행별: 최근 여행 먼저, 안에서는 날짜 순', () => {
    const g = groupByTrip([a, b, c, d], trips);
    expect(g.map((x) => x.tripId)).toEqual(['t2', 't1']);
    expect(g[1]!.days.map((x) => x.date)).toEqual(['2025-05-01', '2025-05-02']);
    expect(g[0]!.visited).toBe(1);
  });

  it('도시별: 여러 여행의 같은 도시를 합치고 방문 많은 곳 먼저', () => {
    const g = groupByCity([a, b, c, d], trips);
    expect(g[0]!.city?.name).toBe('도쿄');
    expect(g[0]!.items).toHaveLength(3); // 센소지 2 + 미정 장소(t2는 도쿄 하나)
    expect(g[0]!.tripCount).toBe(2);
    expect(g[1]!.city?.name).toBe('오사카');
  });

  it('도시를 모르는 기록은 기타 지역으로 맨 끝', () => {
    const e = item('t1', '2025-05-01', '어딘가');
    const g = groupByCity([e, a], trips);
    expect(g.map((x) => x.city?.name ?? null)).toEqual(['도쿄', null]);
  });

  it('장소별: 같은 장소를 합치고 다시 간 곳 먼저', () => {
    const g = groupByPlace([b, a, c]);
    expect(g[0]!.head.title).toBe('센소지');
    expect(g[0]!.visited).toBe(2);
    expect(g[0]!.items.map((x) => x.date)).toEqual(['2025-05-02', '2025-09-01']);
    expect(g[1]!.head.title).toBe('오사카성');
  });
});
