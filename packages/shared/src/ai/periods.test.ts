import { describe, expect, it } from 'vitest';
import { choosePeriod, countByPeriod, withinMonths } from './periods';

const now = new Date('2026-10-23T00:00:00Z');
/** n일 전 YYYYMMDD */
const ago = (n: number) =>
  new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');

describe('AI 추천 기간 확장', () => {
  it('기간 안 판정과 기간별 글 수', () => {
    expect(withinMonths(ago(10), 1, now)).toBe(true);
    expect(withinMonths(ago(40), 1, now)).toBe(false);
    expect(withinMonths('bad', 1, now)).toBe(false);
    expect(countByPeriod([ago(5), ago(50), ago(150), ago(300), ago(500)], now)).toEqual({
      1: 1,
      3: 2,
      6: 3,
      12: 4,
    });
  });

  it('1개월에 2회 이상 언급 장소가 5곳이면 1개월, 부족하면 넓힌다', () => {
    const recent = new Map([...'ABCDE'].map((p) => [p, [ago(3), ago(10)]]));
    expect(choosePeriod(recent, now)).toEqual({ months: 1, enough: true });

    const older = new Map([...'ABCDE'].map((p) => [p, [ago(3), ago(70)]]));
    expect(choosePeriod(older, now)).toEqual({ months: 3, enough: true });

    const sparse = new Map([['A', [ago(3), ago(4)]]]);
    expect(choosePeriod(sparse, now)).toEqual({ months: 12, enough: false });
  });
});
