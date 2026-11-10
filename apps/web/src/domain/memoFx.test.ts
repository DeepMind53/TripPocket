import { describe, expect, it } from 'vitest';
import { convertMoney, memoAmounts, moneyCodes, moneyText } from './memoFx';

describe('메모 속 외화', () => {
  it('기호·단위로 금액과 통화를 찾는다', () => {
    expect(memoAmounts('입장료 ¥1,200, 라멘 980엔\n택시 NT$250 · 마사지 300바트')).toEqual([
      { text: '¥1,200', code: 'JPY', amount: 1200 },
      { text: '980엔', code: 'JPY', amount: 980 },
      { text: 'NT$250', code: 'TWD', amount: 250 },
      { text: '300바트', code: 'THB', amount: 300 },
    ]);
  });
  it('겹치는 기호는 여행 나라 통화로 (¥ = 위안, $ = 대만달러)', () => {
    expect(memoAmounts('¥50', 'CNY')[0]!.code).toBe('CNY');
    expect(memoAmounts('$10, 5달러', 'TWD').map((a) => a.code)).toEqual(['TWD', 'TWD']);
    expect(memoAmounts('$10')[0]!.code).toBe('USD');
  });
  it('NT$는 $로 두 번 세지 않고, 숫자 없는 단어·"동네"는 무시', () => {
    expect(memoAmounts('NT$500')).toHaveLength(1);
    expect(memoAmounts('엔화 환전, 동네 산책')).toEqual([]);
  });
  it('베트남(VND)에서도 $·달러는 미국 달러, "동"은 베트남 여행의 1,000 이상만', () => {
    expect(memoAmounts('Grab $20, 20달러', 'VND').map((a) => a.code)).toEqual(['USD', 'USD']);
    expect(memoAmounts('쌀국수 50,000동', 'VND')).toEqual([
      { text: '50,000동', code: 'VND', amount: 50000 },
    ]);
    expect(memoAmounts('숙소 101동 1203호', 'VND')).toEqual([]);
    expect(memoAmounts('아파트 3000동 앞', 'KRW')).toEqual([]);
  });
});

describe('메모 금액 버튼·환산 (2026-11-10)', () => {
  it('버튼: 원·달러는 늘, 여행 나라 돈은 뒤에', () => {
    expect(moneyCodes('JPY')).toEqual(['KRW', 'USD', 'JPY']);
    expect(moneyCodes('CNY')).toEqual(['KRW', 'USD', 'CNY']);
    expect(moneyCodes('USD')).toEqual(['KRW', 'USD']);
    expect(moneyCodes('KRW')).toEqual(['KRW', 'USD']);
  });
  it('넣는 글은 다시 읽을 수 있는 모양 (달러는 US$)', () => {
    expect(moneyText('JPY', 1000)).toBe('1,000엔');
    expect(moneyText('USD', 12.5)).toBe('US$12.5');
    expect(moneyText('KRW', 9200)).toBe('9,200원');
    expect(memoAmounts('₩ 5,000 · 3000원')).toEqual([
      { text: '₩ 5,000', code: 'KRW', amount: 5000 },
      { text: '3000원', code: 'KRW', amount: 3000 },
    ]);
    for (const c of ['JPY', 'USD', 'KRW', 'CNY'])
      expect(memoAmounts(moneyText(c, 1000)!, 'TWD')[0]!.code).toBe(c);
  });
  it('외화는 원화로, 원화는 여행 나라 돈으로', () => {
    const rates = { JPY: 9.2, USD: 1380, CNY: 190 };
    expect(convertMoney({ code: 'JPY', amount: 1000 }, rates, 'JPY')).toEqual({
      code: 'KRW',
      amount: 9200,
    });
    expect(convertMoney({ code: 'USD', amount: 10 }, rates, 'JPY')).toEqual({
      code: 'KRW',
      amount: 13800,
    });
    expect(convertMoney({ code: 'KRW', amount: 9200 }, rates, 'JPY')).toEqual({
      code: 'JPY',
      amount: 1000,
    });
    expect(convertMoney({ code: 'KRW', amount: 19000 }, rates, 'CNY')).toEqual({
      code: 'CNY',
      amount: 100,
    });
    expect(convertMoney({ code: 'KRW', amount: 1380 }, rates, 'KRW')).toEqual({
      code: 'USD',
      amount: 1,
    });
    expect(convertMoney({ code: 'THB', amount: 1 }, rates, 'THB')).toBeNull();
  });
});
