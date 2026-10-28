import type { Booking } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import {
  airportArriveBy,
  goldenHourStart,
  hoursAhead,
  lateNightAt,
  luggageGap,
  memoLines,
  overlappingIds,
  plugInfo,
  toggleMemoLine,
  tripProgress,
} from './travelExtras';
import { weatherCautions } from './weather';

const T = '2026-10-01T00:00:00.000Z';
const booking = (b: Partial<Booking> & Pick<Booking, 'kind' | 'start'>): Booking =>
  ({ id: b.title ?? 'b', tripId: 't', title: 'b', createdAt: T, updatedAt: T, ...b }) as Booking;

describe('날씨 주의 (2026-10-28 정식)', () => {
  it('비·추위·더위를 모두 모은다', () => {
    expect(weatherCautions({ code: 61, min: 8, max: 14 })).toEqual(['rain', 'cold']);
    expect(weatherCautions({ code: 0, min: 24, max: 33 })).toEqual(['hot']);
    expect(weatherCautions({ code: 73, min: -3, max: 2 })).toEqual(['snow', 'cold', 'freezing']);
    expect(weatherCautions({ code: 95, min: 22, max: 28 })).toEqual(['storm']);
    expect(weatherCautions({ code: 2, min: 15, max: 24 })).toEqual([]);
  });

  it('시차: 방콕은 한국보다 2시간 느리다', () => {
    expect(hoursAhead('Asia/Bangkok')).toBe(-2);
    expect(hoursAhead('Asia/Tokyo')).toBe(0);
  });
});

describe('실험실 2차 (2026-10-28)', () => {
  it('공항 도착 권장: 국제선 3시간·국내선 1시간 30분 전, 자정 넘어가면 전날', () => {
    expect(airportArriveBy('18:30', false)).toEqual({ time: '15:30', prevDay: false, before: 180 });
    expect(airportArriveBy('08:00', true)).toEqual({ time: '06:30', prevDay: false, before: 90 });
    expect(airportArriveBy('01:00', false)).toMatchObject({ time: '22:00', prevDay: true });
  });

  it('시간 겹침: 앞 일정 끝나기 전 시작·같은 시각 시작 (메모 빼고)', () => {
    const ids = overlappingIds([
      { id: 'a', kind: 'place', startTime: '10:00', endTime: '12:00' },
      { id: 'b', kind: 'food', startTime: '11:30' },
      { id: 'c', kind: 'cafe', startTime: '14:00' },
      { id: 'd', kind: 'place', startTime: '14:00' },
      { id: 'm', kind: 'note', startTime: '14:00' },
    ]);
    expect([...ids]).toEqual(['b', 'd']);
  });

  it('골든아워·늦은 귀가', () => {
    expect(goldenHourStart('17:20')).toBe('16:20');
    expect(lateNightAt([{ kind: 'food', startTime: '20:00', endTime: '22:30' }])).toBe('22:30');
    expect(lateNightAt([{ kind: 'food', startTime: '21:00' }])).toBeNull();
    expect(lateNightAt([{ kind: 'note', startTime: '23:00' }])).toBeNull();
  });

  it('체크인 전 짐 보관: 도착 + 1시간 뒤에도 체크인까지 2시간 넘게 남으면', () => {
    const list = [
      booking({
        kind: 'flight',
        start: { date: '2026-11-01', time: '07:00' },
        end: { date: '2026-11-01', time: '09:30' },
      }),
      booking({
        kind: 'lodging',
        title: '신주쿠 호텔',
        start: { date: '2026-11-01', time: '15:00' },
      }),
    ];
    expect(luggageGap(list, '2026-11-01')).toEqual({
      hours: 4,
      checkIn: '15:00',
      name: '신주쿠 호텔',
    });
    expect(luggageGap(list, '2026-11-02')).toBeNull();
  });

  it('콘센트: 일본은 어댑터·낮은 전압, 독일은 그대로, 모르는 나라는 없음', () => {
    expect(plugInfo('JP')).toMatchObject({ adapter: true, lowVolt: true, volt: 100 });
    expect(plugInfo('DE')).toMatchObject({ adapter: false, lowVolt: false });
    expect(plugInfo('ZZ')).toBeNull();
  });

  it('여행 진행률: 며칠째와 오늘까지 다녀온 일정', () => {
    expect(
      tripProgress(
        { startDate: '2026-11-01', endDate: '2026-11-05' },
        [
          { kind: 'place', date: '2026-11-01', done: true },
          { kind: 'place', date: '2026-11-02', visit: 'visited' },
          { kind: 'food', date: '2026-11-03' },
          { kind: 'note', date: '2026-11-03' },
          { kind: 'place', date: '2026-11-04' },
        ],
        '2026-11-03',
      ),
    ).toEqual({ day: 3, days: 5, done: 2, total: 3 });
  });

  it('메모 체크박스: "- "줄만, 누르면 [x] ↔ [ ]', () => {
    const memo = '준비\n- 여권\n- [x] 우산';
    expect(memoLines(memo)).toEqual([
      { text: '준비', checked: null },
      { text: '여권', checked: false },
      { text: '우산', checked: true },
    ]);
    expect(toggleMemoLine(memo, 1)).toBe('준비\n- [x] 여권\n- [x] 우산');
    expect(toggleMemoLine(memo, 2)).toBe('준비\n- 여권\n- [ ] 우산');
    expect(toggleMemoLine(memo, 0)).toBe(memo);
  });
});
