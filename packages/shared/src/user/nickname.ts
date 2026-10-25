/** 닉네임 길이 (글자 수) — 10자 (사용자 결정 2026-10-25) */
export const NICKNAME_MAX = 10;

/** 닉네임에 쓸 수 있는 글자: 한글·한자·영어(로마자)·숫자·공백·_ . - (사용자 결정 2026-10-25) */
const NICK_CHAR = /^[\p{Script=Hangul}\p{Script=Han}\p{Script=Latin}\p{Nd} _.-]$/u;

/** 제어 문자·폭 없는 문자·방향 바꾸는 문자 (화면에서 이름을 속이는 데 쓰일 수 있음) */
const INVISIBLE: readonly (readonly [number, number])[] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
];
const invisible = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return INVISIBLE.some(([from, to]) => c >= from && c <= to);
};

/**
 * 짧은 글 다듬기: 앞뒤 공백을 빼고, 줄바꿈·제어 문자를 지우고, 연속 공백은 하나로.
 * 비었거나 max자를 넘으면 null (AI 추천 키워드 등)
 */
export function cleanShortText(input: unknown, max: number): string | null {
  if (typeof input !== 'string') return null;
  // 줄바꿈·탭은 공백으로 바꾼 뒤 나머지 보이지 않는 문자를 지운다
  const s = [...input.replace(/\s+/g, ' ')]
    .filter((ch) => !invisible(ch))
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim();
  const length = [...s].length;
  return length >= 1 && length <= max ? s : null;
}

/** 닉네임 다듬기·검사 (웹 입력과 서버 저장이 같은 규칙): 10자 이하, 한글·한자·영어·숫자만 */
export function normalizeNickname(input: unknown): string | null {
  const s = cleanShortText(input, NICKNAME_MAX);
  return s && [...s].every((ch) => NICK_CHAR.test(ch)) ? s : null;
}
