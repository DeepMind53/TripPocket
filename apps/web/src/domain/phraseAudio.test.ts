import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PHRASE_IDS, PHRASE_LANGS } from '@trippocket/shared';
import { phraseAudioFile, phraseAudioUrl, spokenPhrase } from './phraseAudio';

const DIR = resolve(__dirname, '../../public/phrases');

describe('회화 음성 파일 (2026-11-26)', () => {
  it('파일 이름은 언어·문장마다 다르고 늘 같다', () => {
    expect(phraseAudioFile('ja', 'ありがとう')).toBe(phraseAudioFile('ja', 'ありがとう'));
    expect(phraseAudioFile('ja', 'ありがとう')).not.toBe(phraseAudioFile('ja', 'こんにちは'));
    expect(phraseAudioFile('zh-CN', '你好')).not.toBe(phraseAudioFile('zh-TW', '你好'));
    expect(phraseAudioUrl('zh-TW', '你好')).toMatch(/^\/phrases\/zh-tw-[0-9a-f]{8}\.mp3$/);
  });

  it('태국어 남/여 끝말은 여성 목소리에 맞춰 하나만 읽는다', () => {
    expect(spokenPhrase('th', 'ขอบคุณครับ/ค่ะ')).toBe('ขอบคุณค่ะ');
    expect(spokenPhrase('th', 'ราคาเท่าไหร่ครับ/คะ')).toBe('ราคาเท่าไหร่คะ');
    expect(spokenPhrase('ja', 'A/B')).toBe('A/B');
  });

  it('모든 언어·문장의 음성 파일이 있고, 쓰지 않는 파일은 없다 (문장을 고치면 scripts/gen-phrase-audio.mjs)', () => {
    const want = new Set<string>();
    for (const l of PHRASE_LANGS)
      for (const id of PHRASE_IDS) {
        const f = phraseAudioFile(l.code, l.phrases[id]);
        want.add(f);
        expect(existsSync(resolve(DIR, f)), `${l.code} ${id}`).toBe(true);
      }
    expect(readdirSync(DIR).filter((f) => f.endsWith('.mp3') && !want.has(f))).toEqual([]);
  });
});
