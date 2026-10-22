import { describe, expect, it } from 'vitest';
import { nightsBetween } from './tripLength';

describe('nightsBetween', () => {
  it('박 수를 계산한다', () => {
    expect(nightsBetween('2026-10-24', '2026-10-28')).toBe(4);
    expect(nightsBetween('2026-10-24', '2026-10-24')).toBe(0);
  });

  it('월말과 윤년을 넘어가도 정확하다', () => {
    expect(nightsBetween('2028-02-27', '2028-03-01')).toBe(3);
    expect(nightsBetween('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('종료일이 빠르거나 날짜가 잘못되면 오류', () => {
    expect(() => nightsBetween('2026-10-28', '2026-10-24')).toThrow();
    expect(() => nightsBetween('2026-02-30', '2026-03-01')).toThrow();
    expect(() => nightsBetween('2026/10/24', '2026-10-25')).toThrow();
  });
});
