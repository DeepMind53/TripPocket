import { describe, expect, it } from 'vitest';
import { busyDay } from './busyDay';

const p = (lat: number, lng = 139.7) => ({
  kind: 'place' as const,
  place: { name: 'x', coords: { lat, lng } },
});

describe('빠듯한 하루', () => {
  it('일정 7개 이상이면 (메모 빼고)', () => {
    const items = [...Array.from({ length: 6 }, () => p(35.68)), { kind: 'note' as const }];
    expect(busyDay(items)).toBeNull();
    expect(busyDay([...items, p(35.68)])).toMatchObject({ count: 7 });
  });
  it('직선거리 합 15km 이상이면, 항공 구간은 빼고', () => {
    expect(busyDay([p(35.6), p(35.75)])).toMatchObject({ count: 2 });
    const flight = {
      kind: 'transport' as const,
      transport: { mode: 'flight' as const },
      place: { name: 'NRT', coords: { lat: 35.77, lng: 140.39 } },
    };
    expect(busyDay([flight, p(35.6)])).toBeNull();
    expect(busyDay([p(35.68), p(35.7)])).toBeNull();
  });
});
