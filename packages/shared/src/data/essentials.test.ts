import { describe, expect, it } from 'vitest';
import { COUNTRY_ESSENTIALS, essentialsFor, passportNeededUntil } from './essentials';

describe('나라별 필수 항목 (docs/19)', () => {
  it('20개국: 나라 코드 중복 없음, 항목 id 고유, 링크는 https(또는 공식 http)', () => {
    const codes = COUNTRY_ESSENTIALS.flatMap((c) => c.codes);
    expect(new Set(codes).size).toBe(codes.length);
    expect(COUNTRY_ESSENTIALS).toHaveLength(20);
    for (const c of COUNTRY_ESSENTIALS) {
      const ids = c.items.map((i) => i.id);
      expect(new Set(ids).size, c.name).toBe(ids.length);
      expect(ids, c.name).toContain('passport');
      for (const u of [
        ...c.items.flatMap((i) => (i.url ? [i.url] : [])),
        ...c.sources.map((s) => s.url),
      ])
        expect(u, c.name).toMatch(/^https?:\/\/[\w.-]+\.\w+/);
    }
  });

  it('괌·사이판은 같은 묶음, 모르는 나라는 없음', () => {
    expect(essentialsFor('MP')?.name).toBe('괌·사이판');
    expect(essentialsFor('KR')).toBeUndefined();
  });

  it('여권 필요 기한: 귀국일 + N개월 (말일 보정), stay = 귀국일', () => {
    expect(passportNeededUntil('2026-11-10', 6)).toBe('2027-05-10');
    expect(passportNeededUntil('2026-08-31', 6)).toBe('2027-02-28');
    expect(passportNeededUntil('2026-11-10', 'stay')).toBe('2026-11-10');
  });
});
