import type { Booking } from '@trippocket/shared';
import { travelLegNow } from './travelLeg';

/** 출국 비행기 → 렌터카 → 귀국 비행기 (사용자 요청 2026-11-02) */
const b = (id: string, kind: Booking['kind'], start: string, end?: string) => {
  const [sd, st] = start.split(' ');
  const [ed, et] = end ? end.split(' ') : [];
  return {
    id,
    tripId: 't',
    kind,
    title: id,
    start: { date: sd, ...(st ? { time: st } : {}) },
    ...(ed ? { end: { date: ed, ...(et ? { time: et } : {}) } } : {}),
  } as Booking;
};
const out = b('출국', 'flight', '2026-11-05 09:00', '2026-11-05 11:30');
const ret = b('귀국', 'flight', '2026-11-09 18:00', '2026-11-09 20:30');
const car = b('렌터카', 'car', '2026-11-05 12:00', '2026-11-08 17:00');

it('도착 전에는 출국편, 도착 뒤 반납 전에는 렌터카, 반납 뒤에는 귀국편', () => {
  const all = [ret, car, out];
  expect(travelLegNow(all, '2026-11-04', '10:00')?.kind).toBe('outbound');
  expect(travelLegNow(all, '2026-11-05', '11:00')?.kind).toBe('outbound');
  expect(travelLegNow(all, '2026-11-05', '11:31')?.kind).toBe('car');
  expect(travelLegNow(all, '2026-11-08', '16:59')?.kind).toBe('car');
  expect(travelLegNow(all, '2026-11-08', '17:00')?.kind).toBe('return');
});

it('렌터카가 없으면 도착 뒤 바로 귀국편, 비행기가 없으면 없음', () => {
  expect(travelLegNow([out, ret], '2026-11-06', '09:00')).toMatchObject({ kind: 'return' });
  expect(travelLegNow([], '2026-11-06', '09:00')).toBeNull();
});
