import type { Booking } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { checkoutsOn, dayRecap, nearbyWishes } from './dayExtras';

const at = (lat: number, lng: number) => ({ name: 'p', coords: { lat, lng } });

describe('하루 덧붙임 (실험실)', () => {
  it('근처 가고 싶은 곳: 그날 장소에서 1km 안, 가까운 순', () => {
    const day = [{ kind: 'place' as const, place: at(35.71, 139.79) }];
    const wishes = [
      { id: 'far', place: at(35.66, 139.7) },
      { id: 'near2', place: at(35.716, 139.79) },
      { id: 'near1', place: at(35.712, 139.79) },
      { id: 'none' },
    ];
    expect(nearbyWishes(day, wishes).map((w) => w.id)).toEqual(['near1', 'near2']);
    expect(nearbyWishes([], wishes)).toEqual([]);
  });

  it('오늘 체크아웃: 그날 끝나는 숙소', () => {
    const b = (id: string, end: string, kind: Booking['kind'] = 'lodging') =>
      ({
        id,
        kind,
        title: id,
        start: { date: '2026-10-24' },
        end: { date: end, time: '11:00' },
      }) as Booking;
    expect(
      checkoutsOn(
        [b('h1', '2026-10-26'), b('h2', '2026-10-25'), b('f', '2026-10-26', 'flight')],
        '2026-10-26',
      ),
    ).toEqual([{ title: 'h1', time: '11:00' }]);
  });

  it('오늘 돌아보기: 방문한 곳 수와 이은 거리 (항공 빼고)', () => {
    const items = [
      { kind: 'place' as const, visit: 'visited' as const, place: at(35.7, 139.7) },
      { kind: 'food' as const, visit: 'skipped' as const, place: at(35.8, 139.7) },
      { kind: 'cafe' as const, done: true, place: at(35.71, 139.7) },
      { kind: 'note' as const, done: true },
    ];
    expect(dayRecap(items)).toEqual({ visited: 2, km: 1.1 });
  });

  it('오늘 돌아보기: 공항까지는 더하고 비행 다음 구간은 잇지 않는다', () => {
    const v = 'visited' as const;
    const items = [
      { kind: 'lodging' as const, visit: v, place: at(37.5, 127.0) },
      // 약 50km 떨어진 공항에서 출발
      {
        kind: 'transport' as const,
        visit: v,
        transport: { mode: 'flight' as const },
        place: at(37.46, 126.44),
      },
      // 도착 도시 (150km — 비행 구간이라 빼야 함)
      { kind: 'place' as const, visit: v, place: at(36.2, 126.0) },
    ];
    const r = dayRecap(items);
    expect(r.km).toBeGreaterThan(45);
    expect(r.km).toBeLessThan(55);
  });
});
