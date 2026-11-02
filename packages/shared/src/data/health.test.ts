import { describe, expect, it } from 'vitest';
import { ALLERGENS, HEALTH_LANGS, healthCardText } from './health';

describe('건강 카드 문장 (2026-11-02)', () => {
  it('모든 언어에 알레르기 단어가 빠짐없이 있다', () => {
    for (const [code, l] of Object.entries(HEALTH_LANGS))
      for (const a of ALLERGENS) expect(l.words[a], `${code} ${a}`).toBeTruthy();
  });

  it('직접 입력: 한국어 카드엔 한글, 다른 언어엔 영어 / 비선호는 따로', () => {
    const input = {
      allergens: ['buckwheat'] as const,
      custom: [
        { ko: '고수', en: 'coriander', kind: 'dislike' as const },
        { ko: '파인애플', en: 'pineapple', kind: 'allergy' as const },
      ],
    };
    const ja = healthCardText('ja', { ...input, allergens: [...input.allergens] });
    expect(ja.allergy).toContain('そば、pineapple');
    expect(ja.dislike).toBe('次のものは入れないでください：coriander');
    const ko = healthCardText('ko', { ...input, allergens: [...input.allergens] });
    expect(ko.dislike).toBe('이 음식은 빼 주세요: 고수');
    expect(healthCardText('en', { allergens: [] }).dislike).toBe('');
    // 무료 AI로 만든 번역이 있으면 그 나라 말로 (2026-11-02)
    const tr = healthCardText('ja', {
      allergens: [],
      custom: [{ ko: '고수', en: 'coriander', kind: 'dislike', tr: { ja: 'パクチー' } }],
    });
    expect(tr.dislike).toBe('次のものは入れないでください：パクチー');
  });
});
