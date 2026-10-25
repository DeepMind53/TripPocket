import type { Booking } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { bookingsToPlan, planDraftsFromBooking, timeSlotIndex } from './bookingPlan';

const base = {
  tripId: 't',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  rev: 0,
} as const;
const arrive = (a: string) => `${a} 도착`;

describe('예약 → 일정표 (처음 한 번)', () => {
  it('항공: 출발 공항(탑승 시각) + 도착 공항(도착 시각), 공항 좌표로 지도 핀', () => {
    const b: Booking = {
      ...base,
      id: 'f',
      kind: 'flight',
      title: '대한항공 KE703',
      start: { date: '2026-11-01', time: '09:10', place: 'ICN' },
      end: { date: '2026-11-01', time: '11:30', place: 'NRT' },
    };
    const [dep, arr] = planDraftsFromBooking(b, arrive);
    expect(dep).toMatchObject({
      date: '2026-11-01',
      startTime: '09:10',
      kind: 'transport',
      bookingId: 'f',
      transport: { mode: 'flight', from: 'ICN', to: 'NRT' },
      place: { name: '인천국제공항' },
    });
    expect(dep?.place?.coords?.lat).toBeCloseTo(37.46, 1);
    expect(arr).toMatchObject({ title: '나리타국제공항 도착', startTime: '11:30' });
    expect(arr?.place?.coords).toBeDefined();
  });

  it('숙소: 체크인 날·체크인 시각, 주소', () => {
    const b: Booking = {
      ...base,
      id: 'l',
      kind: 'lodging',
      title: '호텔 그레이서리',
      start: { date: '2026-11-01', time: '15:00' },
      end: { date: '2026-11-03', time: '11:00' },
      details: { address: '도쿄 신주쿠' },
    };
    expect(planDraftsFromBooking(b, arrive)).toEqual([
      {
        bookingId: 'l',
        date: '2026-11-01',
        kind: 'lodging',
        title: '호텔 그레이서리',
        startTime: '15:00',
        place: { name: '호텔 그레이서리', address: '도쿄 신주쿠' },
      },
    ]);
  });

  it('시각에 맞는 자리: 더 늦은 일정 앞, 없으면 맨 뒤', () => {
    const day = [{ startTime: '08:00' }, {}, { startTime: '12:00' }];
    expect(timeSlotIndex(day, '10:00')).toBe(2);
    expect(timeSlotIndex(day, '07:00')).toBe(0);
    expect(timeSlotIndex(day, '13:00')).toBe(3);
    expect(timeSlotIndex(day, undefined)).toBe(3);
  });

  it('이미 넣은 예약(plannedAt)·연결된 일정이 있는 예약은 다시 넣지 않는다', () => {
    const mk = (id: string, extra: Partial<Booking> = {}): Booking => ({
      ...base,
      id,
      kind: 'restaurant',
      title: id,
      start: { date: '2026-11-01' },
      ...extra,
    });
    const list = [mk('a'), mk('b', { plannedAt: '2026-10-26T00:00:00.000Z' }), mk('c')];
    expect(bookingsToPlan(list, [{ bookingId: 'c' }]).map((b) => b.id)).toEqual(['a']);
  });
});
