import { describe, expect, it } from 'vitest';
import { PHRASE_IDS, PHRASE_LANGS, phraseLangFor, placeLangFor } from './phrases';

describe('여행 회화 (docs/20 G7)', () => {
  it('언어마다 10문장 모두 있음', () => {
    for (const l of PHRASE_LANGS)
      for (const id of PHRASE_IDS) expect(l.phrases[id], `${l.code} ${id}`).toBeTruthy();
  });
  it('나라 → 언어: 일본 일본어, 대만 번체, 영국 영어, 한국은 없음', () => {
    expect(phraseLangFor('JP')?.code).toBe('ja');
    expect(phraseLangFor('TW')?.code).toBe('zh-TW');
    expect(phraseLangFor('GB')?.code).toBe('en');
    expect(phraseLangFor('KR')).toBeUndefined();
    expect(placeLangFor('HK')).toBe('zh-TW');
  });
});
