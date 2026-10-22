import { describe, expect, it } from 'vitest';
import { COUNTRY_CURRENCY, fromKrw, parseEximRow, toKrw } from './fx';

describe('환율', () => {
  it('수출입은행 100단위 통화·콤마를 1단위로', () => {
    expect(parseEximRow('JPY(100)', '912.34')).toEqual(['JPY', 9.1234]);
    expect(parseEximRow('USD', '1,377.5')).toEqual(['USD', 1377.5]);
    expect(parseEximRow('KRW', '1')).toBeNull();
    expect(parseEximRow('USD', '')).toBeNull();
  });

  it('원화 ↔ 외화, 수수료 반영', () => {
    expect(toKrw(3500, 9.1234)).toBeCloseTo(31931.9, 1);
    expect(fromKrw(31931.9, 9.1234)).toBeCloseTo(3500, 1);
    expect(toKrw(100, 10, 1.75)).toBeCloseTo(1017.5, 5);
  });

  it('여행지 나라마다 통화가 있다', () => {
    expect(COUNTRY_CURRENCY.JP).toBe('JPY');
    expect(COUNTRY_CURRENCY.FR).toBe('EUR');
  });
});
