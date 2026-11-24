import type { Booking } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { transferSpots } from './transferSpots';

const bk = (o: Partial<Booking>) =>
  ({ id: 'x', tripId: 't', title: 't', start: { date: '2026-11-03' }, ...o }) as Booking;

const flight = bk({
  id: 'f',
  kind: 'flight',
  title: 'KE703',
  start: { date: '2026-11-03', place: 'ICN' },
  end: { date: '2026-11-03', time: '13:20', place: 'NRT' },
  details: { flightNo: 'KE703', terminal: 'T2', arrivalTerminal: 'T1' },
});
const back = bk({
  id: 'g',
  kind: 'flight',
  title: 'KE704',
  start: { date: '2026-11-06', place: 'NRT' },
  end: { date: '2026-11-06', place: 'ICN' },
  details: { flightNo: 'KE704', terminal: 'T1' },
});
const hotel = bk({
  id: 'h',
  kind: 'lodging',
  title: '호텔 그레이스리',
  start: { date: '2026-11-03', coords: { lat: 35.69, lng: 139.7 } },
});

describe('픽업·드랍 빠른 선택', () => {
  it('픽업은 도착 공항(+터미널)과 그 편명·날짜, 숙소는 좌표와 함께', () => {
    const { airports, lodgings } = transferSpots([hotel, back, flight], 'pickup');
    expect(airports[0]).toMatchObject({ flightNo: 'KE703', date: '2026-11-03', time: '13:20' });
    expect(airports[0]!.name).toMatch(/나리타.*T1$/);
    expect(airports[0]!.coords).toBeDefined();
    expect(lodgings).toEqual([
      expect.objectContaining({ name: '호텔 그레이스리', coords: { lat: 35.69, lng: 139.7 } }),
    ]);
  });
  it('드랍은 출발 공항', () => {
    const { airports } = transferSpots([flight, back], 'drop');
    expect(airports.map((a) => a.flightNo)).toEqual(['KE703', 'KE704']);
    expect(airports[0]!.time).toBeUndefined();
    expect(airports[1]!.name).toMatch(/나리타.*T1$/);
  });
});
