import { describe, expect, it } from 'vitest';
import { COUNTRY_EMERGENCY, emergencyFor, telHref } from './emergency';

describe('긴급 연락처', () => {
  it('나라마다 한 번만, 번호는 숫자·하이픈·+만', () => {
    const codes = COUNTRY_EMERGENCY.map((c) => c.country);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of COUNTRY_EMERGENCY)
      for (const l of c.lines) expect(l.number).toMatch(/^\+?[\d-]+$/);
  });

  it('확인한 나라만 번호가 있다', () => {
    expect(emergencyFor('JP')?.lines.map((l) => l.number)).toEqual(['110', '119', '050-3816-2787']);
    expect(emergencyFor('FR')?.lines).toEqual([{ kind: 'all', number: '112' }]);
    expect(emergencyFor('ZZ')).toBeUndefined();
    expect(emergencyFor(undefined)).toBeUndefined();
  });

  it('전화 링크는 숫자와 +만', () => {
    expect(telHref('+82-2-3210-0404')).toBe('tel:+82232100404');
    expect(telHref('050-3816-2787')).toBe('tel:05038162787');
  });
});
