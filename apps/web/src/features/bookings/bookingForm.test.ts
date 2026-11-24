import { describe, expect, it } from 'vitest';
import type { Trip } from '@trippocket/shared';
import { bookingEndDate, buildBooking, initialBookingForm, morningsOf } from './bookingForm';

const trip = {
  id: 't1',
  startDate: '2026-12-01',
  endDate: '2026-12-04',
} as Trip;

describe('bookingForm', () => {
  it('새 숙소의 체크아웃 기본값은 여행 마지막 날, 아침은 체크인 다음 날부터', () => {
    const f = initialBookingForm(trip, undefined, 'lodging');
    expect(f.startTime).toBe('15:00');
    expect(bookingEndDate('lodging', f, trip)).toBe('2026-12-04');
    expect(morningsOf('2026-12-01', '2026-12-03')).toEqual(['2026-12-02', '2026-12-03']);
  });

  it('항공: 이름이 비면 편명·공항으로 제목, 대문자로', () => {
    const f = {
      ...initialBookingForm(trip, undefined, 'flight'),
      flightNo: 'ke703',
      from: 'icn',
      to: 'nrt',
    };
    const out = buildBooking('flight', f, trip);
    expect(typeof out).toBe('object');
    if (typeof out === 'string') return;
    expect(out.title).toBe('KE703 ICN→NRT');
    expect(out.start.place).toBe('ICN');
    expect(out.details?.flightNo).toBe('KE703');
  });

  it('잘못된 값은 안내 문구로', () => {
    const empty = initialBookingForm(trip, undefined, 'flight');
    expect(buildBooking('flight', empty, trip)).toBe('편명이나 출발·도착 공항을 입력해 주세요');
    const stay = {
      ...initialBookingForm(trip, undefined, 'lodging'),
      title: '호텔',
      endDate: '2026-12-01',
    };
    expect(buildBooking('lodging', stay, trip)).toBe('체크아웃은 체크인 다음 날 이후여야 해요');
  });

  it('모든 아침 조식이면 날짜 목록은 저장하지 않는다', () => {
    const f = {
      ...initialBookingForm(trip, undefined, 'lodging'),
      title: '호텔',
      breakfast: true,
      breakfastDates: ['2026-12-03', '2026-12-02', '2026-12-04'],
    };
    const out = buildBooking('lodging', f, trip);
    if (typeof out === 'string') throw new Error(out);
    expect(out.details?.breakfast).toBe(true);
    expect(out.details?.breakfastDates).toBeUndefined();
    const some = buildBooking('lodging', { ...f, breakfastDates: ['2026-12-03'] }, trip);
    if (typeof some === 'string') throw new Error(some);
    expect(some.details?.breakfastDates).toEqual(['2026-12-03']);
  });
});
