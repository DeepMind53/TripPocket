import type { Booking } from '@trippocket/shared';
import { travelLegNow, travelLegsAhead } from './travelLeg';

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

it('기차·버스도 순서대로 (2026-11-03): 출국 → 기차 → 렌터카 → 귀국, 렌터카 중에도 그날 떠나는 버스는 먼저', () => {
  const ktx = { ...b('KTX', 'train', '2026-11-05 14:00', '2026-11-05 16:30') };
  const bus = { ...b('고속버스', 'train', '2026-11-07 09:00', '2026-11-07 12:00') };
  const car2 = b('렌터카', 'car', '2026-11-06 10:00', '2026-11-08 17:00');
  const all = [ret, car2, out, ktx, bus];
  expect(travelLegNow(all, '2026-11-05', '12:00')?.kind).toBe('train');
  expect(travelLegNow(all, '2026-11-06', '12:00')?.kind).toBe('car');
  expect(travelLegNow(all, '2026-11-07', '08:00')?.kind).toBe('bus');
  expect(travelLegNow(all, '2026-11-07', '12:01')?.kind).toBe('car');
  expect(travelLegsAhead(all, '2026-11-05', '12:00').map((l) => l.kind)).toEqual([
    'train',
    'car',
    'bus',
    'return',
  ]);
});
