import { describe, expect, it } from 'vitest';
import { baggageHint, baggageWithUnit, joinBaggage, splitBaggage } from './flightBaggage';

describe('항공 수하물 기내·위탁', () => {
  it('저장된 글자를 두 칸으로', () => {
    expect(splitBaggage('위탁 23kg · 기내 7kg')).toEqual({ cabin: '7kg', checked: '23kg' });
    expect(splitBaggage('기내 10kg')).toEqual({ cabin: '10kg', checked: '' });
    expect(splitBaggage('2개 23kg')).toEqual({ cabin: '', checked: '2개 23kg' });
    expect(splitBaggage(undefined)).toEqual({ cabin: '', checked: '' });
  });
  it('두 칸을 한 줄로, 숫자만 쓰면 kg', () => {
    expect(joinBaggage({ cabin: '7', checked: '23' })).toBe('위탁 23kg · 기내 7kg');
    expect(joinBaggage({ cabin: '', checked: '2개 23kg' })).toBe('위탁 2개 23kg');
    expect(joinBaggage({ cabin: ' ', checked: '' })).toBeUndefined();
  });
  it('나눴다 다시 합치면 같은 글자', () => {
    const s = '위탁 23kg · 기내 7kg';
    expect(joinBaggage(splitBaggage(s))).toBe(s);
  });
});

describe('항공사 대표 수하물 참고값', () => {
  it('처음 나온 무게, 기본 운임에 없으면 "없음"', () => {
    expect(baggageHint('1개 + 개인 물품 · 합계 10kg · 세 변 합 115cm')).toBe('10kg');
    expect(baggageHint('1개 23kg (미주 2개) · 세 변 합 158cm')).toBe('23kg');
    expect(baggageHint('운임에 따라 15~20kg')).toBe('15~20kg');
    expect(baggageHint('스탠다드 15kg · 비즈 라이트 30kg · 베이직 없음')).toBe('15kg');
    expect(baggageHint('플라이 없음 · 플라이백 20kg')).toBe('없음');
    expect(baggageHint('공식 안내 확인')).toBeUndefined();
    expect(baggageHint(undefined)).toBeUndefined();
  });
  it('숫자만 쓰면 kg', () => {
    expect(baggageWithUnit('7')).toBe('7kg');
    expect(baggageWithUnit('1개 23kg')).toBe('1개 23kg');
  });
});
