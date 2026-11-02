import { describe, expect, it } from 'vitest';
import { AIRLINE_BAGGAGE, baggageFor } from './baggage';

describe('항공사 수하물 대표값 (2026-11-03)', () => {
  it('항공사 이름이나 편명 앞 두 글자로 찾는다', () => {
    expect(baggageFor('대한항공')?.code).toBe('KE');
    expect(baggageFor('', 'LJ201')?.code).toBe('LJ');
    expect(baggageFor('Jeju Air', '')?.code).toBe('7C');
    expect(baggageFor('ANA', 'NH9')).toBeUndefined();
  });
  it('모든 항공사에 공식 안내 링크(https)가 있다', () => {
    for (const a of AIRLINE_BAGGAGE) expect(a.url, a.code).toMatch(/^https:\/\//);
  });
});
