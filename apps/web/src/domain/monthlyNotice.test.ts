import { describe, expect, it } from 'vitest';
import { noticeDay, shouldShowNotice } from './monthlyNotice';

describe('관리자 월간 안내 날짜', () => {
  it('달마다 1~28일 중 하나, 같은 달·사람이면 늘 같은 날', () => {
    const days = ['2026-11', '2026-12', '2027-01', '2027-02'].map((m) => noticeDay(m, 'admin'));
    for (const d of days) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(28);
    }
    expect(noticeDay('2026-11', 'admin')).toBe(days[0]);
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it('그날부터 그달 안에 한 번만', () => {
    const d = noticeDay('2026-11', 'a');
    const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}`;
    if (d > 1) expect(shouldShowNotice(day(d - 1), null, 'a')).toBe(false);
    expect(shouldShowNotice(day(d), null, 'a')).toBe(true);
    expect(shouldShowNotice(day(28), '2026-10', 'a')).toBe(true);
    expect(shouldShowNotice(day(28), '2026-11', 'a')).toBe(false);
  });
});
