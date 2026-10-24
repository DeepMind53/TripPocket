/** 닉네임 길이 (글자 수, 이모지 1개 = 1글자) */
export const NICKNAME_MAX = 20;

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
 * 닉네임 다듬기·검사 (웹 입력과 서버 저장이 같은 규칙).
 * 앞뒤 공백을 빼고, 줄바꿈·제어 문자를 지우고, 연속 공백은 하나로. 비었거나 20자를 넘으면 null
 */
export function normalizeNickname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  // 줄바꿈·탭은 공백으로 바꾼 뒤 나머지 보이지 않는 문자를 지운다
  const s = [...input.replace(/\s+/g, ' ')]
    .filter((ch) => !invisible(ch))
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim();
  const length = [...s].length;
  return length >= 1 && length <= NICKNAME_MAX ? s : null;
}
