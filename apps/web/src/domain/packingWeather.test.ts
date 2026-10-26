import { describe, expect, it } from 'vitest';
import { packingTips } from './packingWeather';

describe('날씨 맞춤 준비물', () => {
  it('비·더위·추위에 맞춰 제안, 이미 있는 것은 뺀다', () => {
    const days = [
      { code: 61, min: 20, max: 30 },
      { code: 0, min: 3, max: 12 },
    ];
    expect(packingTips(days, []).map((t) => t.text)).toEqual([
      '우산',
      '선크림',
      '모자',
      '두꺼운 겉옷',
      '장갑',
    ]);
    expect(packingTips(days, ['접이식 우산', '선크림 SPF50']).map((t) => t.text)).toEqual([
      '모자',
      '두꺼운 겉옷',
      '장갑',
    ]);
  });
  it('눈이면 방수 신발, 날씨가 없으면 제안 없음', () => {
    expect(packingTips([{ code: 73, min: 0, max: 8 }], []).map((t) => t.reason)).toContain('snow');
    expect(packingTips([], [])).toEqual([]);
  });
});
