import type { Booking } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import {
  checkinsOn,
  flightInAir,
  homeTimeOf,
  hoursAhead,
  instantOf,
  isRainCode,
  returnFlightFor,
  tipOf,
  todayBrief,
} from './travelExtras';

const flight = (o: Partial<Booking>): Booking =>
  ({
    id: 'f',
    tripId: 't',
    kind: 'flight',
    title: 'KE703',
    start: { date: '2026-11-01', time: '09:00', timezone: 'Asia/Seoul' },
    end: { date: '2026-11-01', time: '11:20', timezone: 'Asia/Tokyo' },
    createdAt: '',
    updatedAt: '',
    ...o,
  }) as Booking;

describe('실험실 계산 (2026-10-27)', () => {
  it('여행지 시각 → 순간 → 한국 시각, 같은 시간대면 없음', () => {
    expect(new Date(instantOf('2026-11-01', '09:00', 'Asia/Seoul')!).toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
    expect(homeTimeOf('2026-11-01', '09:00', 'Asia/Bangkok')).toBe('11:00');
    expect(homeTimeOf('2026-11-01', '09:00', 'Asia/Tokyo')).toBeNull();
    // 뉴욕(서머타임 끝난 뒤) 09:00 = 한국 23:00
    expect(homeTimeOf('2026-11-10', '09:00', 'America/New_York')).toBe('23:00');
  });

  it('시차: 방콕은 한국보다 2시간 느리다', () => {
    expect(hoursAhead('Asia/Bangkok', 'Asia/Seoul', Date.UTC(2026, 10, 1))).toBe(-2);
    expect(hoursAhead('Asia/Tokyo', 'Asia/Seoul', Date.UTC(2026, 10, 1))).toBe(0);
  });

  it('비 예보 코드', () => {
    expect([61, 81, 95].every(isRainCode)).toBe(true);
    expect([0, 3, 71].some(isRainCode)).toBe(false);
  });

  it('체크인·귀국 전날', () => {
    const hotel = {
      ...flight({}),
      kind: 'lodging',
      title: '호텔',
      start: { date: '2026-11-01', time: '15:00' },
      end: { date: '2026-11-03' },
    } as Booking;
    expect(checkinsOn([hotel], '2026-11-01')).toEqual([{ title: '호텔', time: '15:00' }]);
    const back = flight({ title: 'KE704', start: { date: '2026-11-03', time: '18:30' } });
    expect(returnFlightFor([back], '2026-11-03', '2026-11-02')).toEqual({
      title: 'KE704',
      time: '18:30',
    });
    expect(returnFlightFor([back], '2026-11-03', '2026-11-01')).toBeNull();
  });

  it('비행 중: 출발·도착 시간대를 따로 보고 남은 분', () => {
    const f = flight({});
    // 한국 09:00 출발(00:00Z) → 도쿄 11:20 도착(02:20Z). 01:00Z면 80분 남음
    expect(flightInAir([f], 'Asia/Tokyo', Date.UTC(2026, 10, 1, 1, 0))).toEqual({
      title: 'KE703',
      minutesLeft: 80,
    });
    expect(flightInAir([f], 'Asia/Tokyo', Date.UTC(2026, 10, 1, 3, 0))).toBeNull();
  });

  it('오늘 요약·팁', () => {
    expect(
      todayBrief([
        { kind: 'place', startTime: '13:00' },
        { kind: 'note', startTime: '08:00' },
        { kind: 'food', startTime: '09:30' },
        { kind: 'cafe' },
      ]),
    ).toEqual({ count: 3, first: '09:30' });
    expect(tipOf(42.5, 18)).toEqual({ tip: 7.65, total: 50.15 });
  });
});
