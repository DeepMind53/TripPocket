import { describe, expect, it } from 'vitest';
import { PHRASE_IDS, PHRASE_LANGS, phraseLangFor, placeLangFor } from './phrases';

describe('여행 회화 (docs/20 G7)', () => {
  it('20개 언어, 언어마다 20문장 모두 있음 (2026-11-26 확장)', () => {
    expect(PHRASE_LANGS).toHaveLength(20);
    expect(PHRASE_IDS).toHaveLength(20);
    expect(new Set(PHRASE_LANGS.map((l) => l.code)).size).toBe(20);
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
  it('새 나라: 말레이시아·필리핀·스위스·체코·튀르키예·포르투갈·러시아·라오스, 괌·호주는 영어', () => {
    expect(phraseLangFor('MY')?.code).toBe('ms');
    expect(phraseLangFor('PH')?.code).toBe('fil');
    expect(phraseLangFor('CH')?.code).toBe('de');
    expect(phraseLangFor('CZ')?.code).toBe('cs');
    expect(phraseLangFor('TR')?.code).toBe('tr');
    expect(phraseLangFor('PT')?.code).toBe('pt');
    expect(phraseLangFor('RU')?.code).toBe('ru');
    expect(phraseLangFor('LA')?.code).toBe('lo');
    expect(phraseLangFor('GU')?.code).toBe('en');
    expect(phraseLangFor('AU')?.code).toBe('en');
  });
});
