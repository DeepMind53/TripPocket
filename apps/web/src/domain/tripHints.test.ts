import type { Booking, Trip } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import {
  bestWalkWindow,
  bookingIssues,
  daylightLeft,
  earlierTripTo,
  farPlaceIds,
  krHolidaysNear,
  memoryOfToday,
  phraseOfDay,
  shorterOrder,
  tempDiff,
} from './tripHints';

const trip = (id: string, name: string, startDate: string, endDate: string) =>
  ({ id, title: name, destinations: [{ name, kind: 'city' }], startDate, endDate }) as Trip;

describe('새 실험 계산 (2026-11-13)', () => {
  it('오늘의 한마디: 일차마다 돌아감', () => {
    expect(phraseOfDay(['a', 'b', 'c'], 1)).toBe('a');
    expect(phraseOfDay(['a', 'b', 'c'], 4)).toBe('a');
    expect(phraseOfDay(['a', 'b', 'c'], 2)).toBe('b');
  });

  it('걷기 좋은 시간: 비 없고 8~27°가 2시간 넘게', () => {
    const code = Array<number>(24).fill(0);
    const temp = Array<number>(24).fill(20);
    code[12] = 61; // 12시 비
    expect(bestWalkWindow({ code, temp }, 9)).toEqual({ from: 13, to: 22 });
    temp.fill(32);
    expect(bestWalkWindow({ code, temp }, 9)).toBeNull();
    expect(bestWalkWindow(undefined, 9)).toBeNull();
  });

  it('해 지기까지: 3시간 안쪽만', () => {
    expect(daylightLeft('16:00', '17:30')).toBe(90);
    expect(daylightLeft('12:00', '17:30')).toBeNull();
    expect(daylightLeft('18:00', '17:30')).toBeNull();
  });

  it('더 짧은 순서: 첫 장소는 두고 가까운 곳부터', () => {
    const s = (id: string, lng: number) => ({ id, title: id, coords: { lat: 35, lng } });
    // A(0) → C(0.2) → B(0.1): 되돌아가는 길
    const r = shorterOrder([s('A', 135), s('C', 135.2), s('B', 135.1)]);
    expect(r?.titles).toEqual(['A', 'B', 'C']);
    expect(r!.saveKm).toBeGreaterThan(1);
    expect(shorterOrder([s('A', 135), s('B', 135.1), s('C', 135.2)])).toBeNull();
  });

  it('멀리 떨어진 장소: 가운데에서 80km 넘게', () => {
    const c = (lat: number, lng: number) => ({ lat, lng });
    const all = [c(34.69, 135.5), c(34.7, 135.49), c(34.68, 135.52), c(35.68, 139.76)];
    const far = farPlaceIds([{ id: 'tokyo', title: '도쿄 타워', coords: c(35.68, 139.76) }], all);
    expect(far.has('tokyo')).toBe(true);
    // 두 도시를 반씩 도는 여행은 알리지 않는다
    expect(
      farPlaceIds([], [c(34.7, 135.5), c(34.7, 135.5), c(35.7, 139.8), c(35.7, 139.8)]).size,
    ).toBe(0);
  });

  it('다시 찾은 도시·N년 전 오늘', () => {
    const now = trip('n', '오사카', '2026-12-01', '2026-12-03');
    const old = trip('o', '오사카', '2024-11-12', '2024-11-15');
    expect(earlierTripTo(now, [now, old])?.id).toBe('o');
    expect(earlierTripTo(now, [now, trip('x', '도쿄', '2024-01-01', '2024-01-02')])).toBeNull();
    expect(memoryOfToday([old], '2026-11-13')).toEqual({ trip: old, years: 2, dayN: 2 });
    expect(memoryOfToday([old], '2026-11-20')).toBeNull();
  });

  it('서울과 기온·한국 연휴', () => {
    expect(tempDiff({ code: 0, min: 20, max: 30 }, { code: 0, min: 10, max: 20 })).toBe(10);
    expect(
      krHolidaysNear(
        { startDate: '2026-09-25', endDate: '2026-09-28' },
        { '2026-09-24': '추석', '2026-09-25': '추석', '2026-10-03': '개천절' },
      ),
    ).toEqual(['추석']);
  });

  it('예약 날짜 맞춰 보기', () => {
    const b = (x: Partial<Booking>) => ({ id: x.title, kind: 'flight', ...x }) as Booking;
    const issues = bookingIssues({ startDate: '2026-11-03', endDate: '2026-11-05' }, [
      b({
        title: '가는 편',
        start: { date: '2026-11-03' },
        end: { date: '2026-11-03', time: '23:10' },
      }),
      b({ title: '오는 편', start: { date: '2026-11-05' } }),
      b({
        title: '호텔',
        kind: 'lodging',
        start: { date: '2026-11-03' },
        end: { date: '2026-11-06' },
      }),
      b({ title: '투어', kind: 'tour', start: { date: '2026-12-04' } }),
    ]);
    expect(issues).toEqual([
      { kind: 'outside', title: '투어', date: '2026-12-04' },
      { kind: 'stayAfterFlight', title: '호텔', date: '2026-11-06' },
      { kind: 'lateArrival', title: '가는 편', time: '23:10' },
    ]);
  });
});
