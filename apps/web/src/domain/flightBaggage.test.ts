import { describe, expect, it } from 'vitest';
import { joinBaggage, splitBaggage } from './flightBaggage';

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
