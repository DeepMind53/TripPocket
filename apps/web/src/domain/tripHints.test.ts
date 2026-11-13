import { describe, expect, it } from 'vitest';
import { bestWalkWindow, daylightLeft, phraseOfDay, shorterOrder } from './tripHints';

describe('오늘 도움 줄·더 짧은 순서 계산 (2026-11-13)', () => {
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
});
