/**
 * 회화 음성 파일 (2026-11-26 사용자 요청 "소리를 직접 만들어서 넣어 줘"): 기기 읽기 기능이 안 되는 기기가 있어
 * 문장마다 미리 만든 mp3를 앱에 넣는다 (apps/web/scripts/gen-phrase-audio.mjs, public/phrases/).
 * 파일 이름 = 언어·문장의 해시 — 문장을 고치면 이름이 바뀌어 옛 소리가 남지 않는다 (시험이 빠진 파일을 잡는다).
 * 누른 동작 안에서 바로 틀어야 하므로(아이폰) 동기 해시(FNV-1a 32비트)를 쓴다
 */
export function phraseAudioFile(lang: string, text: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${lang}|${text}`) {
    const c = ch.codePointAt(0)!;
    h ^= c;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${lang.toLowerCase()}-${h.toString(16).padStart(8, '0')}.mp3`;
}

export const phraseAudioUrl = (lang: string, text: string) =>
  `/phrases/${phraseAudioFile(lang, text)}`;

/**
 * 소리로 읽을 글: 태국어 "ครับ/ค่ะ"(남/여 끝말)는 여성 목소리에 맞춰 ค่ะ·คะ 하나만 — 빗금까지 읽으면 소리가 안 만들어진다.
 * 화면 글자와 파일 이름은 원래 문장 그대로
 */
export const spokenPhrase = (lang: string, text: string) =>
  lang === 'th' ? text.replace(/ครับ\/(ค่ะ|คะ)/g, '$1') : text;
