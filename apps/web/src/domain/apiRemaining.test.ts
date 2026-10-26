import { describe, expect, it } from 'vitest';
import { remainingRatio, remainingTone } from './apiRemaining';

describe('remainingRatio', () => {
  it('월·하루 중 더 적게 남은 쪽', () => {
    expect(remainingRatio({ freeMonthly: 1000, freeDaily: null, used: 900, today: 0 })).toBeCloseTo(
      0.1,
    );
    expect(remainingRatio({ freeMonthly: 1000, freeDaily: 100, used: 100, today: 97 })).toBeCloseTo(
      0.03,
    );
    expect(remainingRatio({ freeMonthly: null, freeDaily: null, used: 5, today: 1 })).toBeNull();
    expect(remainingRatio({ freeMonthly: 10, freeDaily: null, used: 20, today: 0 })).toBe(0);
  });

  it('5% 미만 빨강, 20% 미만 주황', () => {
    expect(remainingTone(0.04)).toBe('danger');
    expect(remainingTone(0.19)).toBe('warning');
    expect(remainingTone(0.2)).toBeNull();
    expect(remainingTone(null)).toBeNull();
  });
});
