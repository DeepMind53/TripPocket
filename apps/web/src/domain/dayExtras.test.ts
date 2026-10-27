import type { Booking } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { checkoutsOn, dayRecap, freeGaps, nearbyWishes } from './dayExtras';

const at = (lat: number, lng: number) => ({ name: 'p', coords: { lat, lng } });

describe('하루 덧붙임 (실험실)', () => {
  it('빈 시간: 앞 일정이 끝나고(없으면 시작) 다음 시작까지 2시간 이상', () => {
    const items = [
      { id: 'a', kind: 'place' as const, startTime: '09:00', endTime: '10:00' },
      { id: 'm', kind: 'note' as const, startTime: '11:00' },
      { id: 'b', kind: 'food' as const, startTime: '12:30' },
      { id: 'c', kind: 'cafe' as const, startTime: '13:00' },
      { id: 'x', kind: 'place' as const },
      { id: 'd', kind: 'place' as const, startTime: '15:00' },
    ];
    expect(freeGaps(items)).toEqual([
      { afterId: 'a', minutes: 150 },
      { afterId: 'c', minutes: 120 },
    ]);
  });

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
});
