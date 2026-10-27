import { describe, expect, it } from 'vitest';
import { memoAmounts } from './memoFx';

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
});
