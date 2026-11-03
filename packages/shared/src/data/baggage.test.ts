import { describe, expect, it } from 'vitest';
import { AIRLINE_BAGGAGE, baggageFor } from './baggage';

describe('항공사 수하물 대표값 (2026-11-03)', () => {
  it('항공사 이름이나 편명 앞 두 글자로 찾는다', () => {
    expect(baggageFor('대한항공')?.code).toBe('KE');
    expect(baggageFor('', 'LJ201')?.code).toBe('LJ');
    expect(baggageFor('Jeju Air', '')?.code).toBe('7C');
    expect(baggageFor('', 'NH9')?.code).toBe('NH');
    // 해외 LCC (2026-11-03 추가)
    expect(baggageFor('타이거에어 타이완', '')?.code).toBe('IT');
    expect(baggageFor('', 'IT603')?.lcc).toBe(true);
    expect(baggageFor('', 'MM702')?.name).toBe('피치항공');
    expect(baggageFor('타이 에어아시아')?.code).toBe('FD');
    expect(baggageFor('에어아시아')?.code).toBe('AK');
    expect(baggageFor('Air Canada')).toBeUndefined();
  });
  it('모든 항공사에 공식 안내 링크(https)가 있다', () => {
    for (const a of AIRLINE_BAGGAGE) expect(a.url, a.code).toMatch(/^https:\/\//);
  });
  it('편명 코드가 겹치지 않고, 국내외 LCC는 lcc 표시가 있다', () => {
    const codes = AIRLINE_BAGGAGE.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of [
      '7C',
      'LJ',
      'TW',
      'BX',
      'RS',
      'ZE',
      'RF',
      'IT',
      'MM',
      'TR',
      'VJ',
      '5J',
      'UO',
      'AK',
    ])
      expect(AIRLINE_BAGGAGE.find((a) => a.code === c)?.lcc, c).toBe(true);
  });
});
