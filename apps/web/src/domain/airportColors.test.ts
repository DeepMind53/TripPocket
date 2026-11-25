import type { Booking } from '@trippocket/shared';
import { airportColorIndex } from './airportColors';

const flight = (id: string, date: string, from: string, to: string) =>
  ({
    id,
    kind: 'flight',
    title: id,
    start: { date, place: from },
    end: { date, place: to },
  }) as Booking;

it('공항마다 색: 같은 공항은 같은 번호, 나리타 도착·하네다 출발은 다른 번호 (2026-11-25)', () => {
  const m = airportColorIndex([
    flight('back', '2026-11-05', 'HND', 'ICN'),
    flight('go', '2026-11-01', 'ICN', 'nrt'),
  ]);
  expect([...m.entries()]).toEqual([
    ['ICN', 0],
    ['NRT', 1],
    ['HND', 2],
  ]);
});

it('항공 하나뿐이거나 지운 것만 남으면 칠하지 않는다', () => {
  expect(airportColorIndex([flight('go', '2026-11-01', 'ICN', 'NRT')]).size).toBe(0);
  expect(
    airportColorIndex([
      flight('go', '2026-11-01', 'ICN', 'NRT'),
      { ...flight('x', '2026-11-02', 'NRT', 'ICN'), deletedAt: 'x' } as Booking,
    ]).size,
  ).toBe(0);
});
