/**
 * 사진 속 글자 줄 (사진 위에 번역 덮기, 2026-11-25 사용자 요청 "글씨만 따로 보면 헷갈림").
 * 화면 없는 계산만 — 번역이 필요한지, 덮개를 놓을 자리(사진 크기 대비 %)
 */
export interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
  a: number;
}

const HANGUL = /[가-힣]/g;
const LETTER = /[\p{L}]/gu;

/** 줄들이 이미 한국어인지: 글자(숫자·기호 빼고) 중 한글이 절반을 넘으면 번역하지 않는다 */
export function needsTranslation(lines: readonly string[]): boolean {
  let letters = 0;
  let hangul = 0;
  for (const l of lines) {
    letters += l.match(LETTER)?.length ?? 0;
    hangul += l.match(HANGUL)?.length ?? 0;
  }
  return letters > 0 && hangul / letters < 0.5;
}

/** 사진 원래 크기(px) 기준 상자 → 화면 % 자리. 글자 크기는 사진 폭 대비(cqw)로 */
export function placeBox(box: Box, width: number, height: number) {
  return {
    left: (box.cx / width) * 100,
    top: (box.cy / height) * 100,
    width: (box.w / width) * 100,
    height: (box.h / height) * 100,
    /** 사진 폭 1% = 1cqw 기준 글자 크기 (줄 높이의 약 75%) */
    fontCqw: (box.h / width) * 100 * 0.75,
    deg: (box.a * 180) / Math.PI,
  };
}
