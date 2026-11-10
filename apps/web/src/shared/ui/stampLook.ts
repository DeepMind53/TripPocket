/** 문자열 → 0 이상 정수 (모양·기울기 고정용) */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 같은 여행·나라는 늘 같은 모양·기울기 (도장 이미지 저장 features/records/stampSheet.ts도 같은 값) */
export function stampLook(
  seed: string,
  city: string,
): { round: boolean; rotate: number; size: number } {
  const h = hash(seed);
  const len = city.length;
  return { round: h % 2 === 0, rotate: (h % 21) - 10, size: len > 9 ? 7.5 : len > 6 ? 9 : 11 };
}
