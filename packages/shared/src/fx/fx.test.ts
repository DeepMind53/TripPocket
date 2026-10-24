import { describe, expect, it } from 'vitest';
import {
  COUNTRY_CURRENCY,
  fromKrw,
  parseEximRow,
  toKrw,
  mergeFallbackRates,
  upcomingTripCurrencies,
} from './fx';

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

describe('수출입은행에 없는 통화는 보조 출처로', () => {
  const exim = {
    source: 'koreaexim' as const,
    date: '2026-10-23',
    fetchedAt: '',
    rates: { JPY: 9.1, USD: 1377 },
  };
  it('없는 통화만 채우고 어떤 통화를 채웠는지 남긴다 (수출입은행 값이 먼저)', () => {
    const extra = {
      source: 'currency-api' as const,
      date: '2026-10-24',
      fetchedAt: '',
      rates: { JPY: 9.5, TWD: 43.2, KRW: 1 },
    };
    expect(mergeFallbackRates(exim, extra)).toMatchObject({
      rates: { JPY: 9.1, USD: 1377, TWD: 43.2 },
      fallback: { codes: ['TWD'], date: '2026-10-24' },
    });
    expect(mergeFallbackRates(exim, null)).toBe(exim);
  });
});

describe('환율 처음 통화 = 다가오는 여행 나라', () => {
  const trip = (start: string, end: string, ...cc: string[]) => ({
    startDate: start,
    endDate: end,
    destinations: cc.map((countryCode) => ({ countryCode })),
  });
  it('끝난 여행·지운 여행·원화는 빼고 가까운 여행부터', () => {
    expect(
      upcomingTripCurrencies(
        [
          trip('2026-12-01', '2026-12-05', 'JP'),
          trip('2026-10-01', '2026-10-05', 'US'),
          { ...trip('2026-11-01', '2026-11-03', 'TH'), deletedAt: '2026-10-20' },
          trip('2026-11-10', '2026-11-12', 'TW', 'KR'),
          trip('2026-10-20', '2026-10-25', 'JP'),
        ],
        '2026-10-24',
      ),
    ).toEqual(['JPY', 'TWD']);
  });
});
