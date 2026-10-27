import { describe, expect, it } from 'vitest';
import { COUNTRY_EMOJIS, COVER_COLORS, DEFAULT_EMOJIS } from './coverColors';
import { emojiRows } from './emojiRows';

describe('여행 이모지·색', () => {
  it('첫 줄은 국기 + 그 나라 5종, 다음 줄은 공통 10종 (순서 고정)', () => {
    const r = emojiRows(['JP']);
    expect(r.country).toEqual(['🇯🇵', '🗼', '🍣', '🍜', '🗻', '🌸']);
    expect(r.common).toEqual([...DEFAULT_EMOJIS]);
    // 고른 이모지가 앞으로 옮겨 가지 않는다
    expect(emojiRows(['JP'], '🍣')).toEqual(r);
  });
  it('예전에 고른 이모지는 공통 줄 끝에, 모르는 나라는 국기 + 공통', () => {
    expect(emojiRows(['JP'], '🎡').common.at(-1)).toBe('🎡');
    expect(emojiRows(['ZZ']).country).toHaveLength(1);
    expect(emojiRows([]).country).toEqual([]);
  });
  it('나라마다 5종, 색 20가지는 모두 다르다', () => {
    for (const list of Object.values(COUNTRY_EMOJIS)) expect(list).toHaveLength(5);
    expect(DEFAULT_EMOJIS).toHaveLength(10);
    expect(new Set(COVER_COLORS.map((c) => c.toLowerCase())).size).toBe(20);
  });
});
