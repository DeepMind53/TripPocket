import type { Booking } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { flightSignature, flightsToReconfirm } from './flightCheck';

const flight = (id: string, date: string, extra: Partial<Booking> = {}) =>
  ({
    id,
    tripId: 't',
    kind: 'flight',
    title: id,
    start: { date, time: '10:00' },
    createdAt: '',
    updatedAt: '',
    ...extra,
  }) as Booking;

describe('flightsToReconfirm', () => {
  const list = [flight('out', '2026-11-12'), flight('back', '2026-11-16')];

  it('출발 전날부터 출발 날까지만', () => {
    expect(flightsToReconfirm(list, '2026-11-10', {}).map((b) => b.id)).toEqual([]);
    expect(flightsToReconfirm(list, '2026-11-11', {}).map((b) => b.id)).toEqual(['out']);
    expect(flightsToReconfirm(list, '2026-11-12', {}).map((b) => b.id)).toEqual(['out']);
    expect(flightsToReconfirm(list, '2026-11-13', {}).map((b) => b.id)).toEqual([]);
    expect(flightsToReconfirm(list, '2026-11-15', {}).map((b) => b.id)).toEqual(['back']);
  });

  it('확인하면 빠지고, 출발 시각이 바뀌면 다시', () => {
    const ok = { out: flightSignature(list[0]!) };
    expect(flightsToReconfirm(list, '2026-11-11', ok)).toEqual([]);
    const moved = [flight('out', '2026-11-12', { start: { date: '2026-11-12', time: '15:00' } })];
    expect(flightsToReconfirm(moved, '2026-11-11', ok).map((b) => b.id)).toEqual(['out']);
  });

  it('항공 아닌 예약·지운 예약은 아님', () => {
    const other = [
      flight('hotel', '2026-11-12', { kind: 'lodging' }),
      flight('gone', '2026-11-12', { deletedAt: 'x' }),
    ];
    expect(flightsToReconfirm(other, '2026-11-11', {})).toEqual([]);
  });
});
