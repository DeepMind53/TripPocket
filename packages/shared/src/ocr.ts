/**
 * 영수증 글자 인식 결과 (POST /api/ocr, ADR-0012 — 2026-11-11). 사진은 서버를 거쳐 가기만 하고 저장하지 않는다.
 * source: google = Cloud Vision, azure = Azure AI Vision Read. left = 오늘 남은 횟수 (한 사람 하루 20장)
 */
export interface OcrResult {
  text: string;
  source: 'google' | 'azure';
  left: number;
  /** 줄마다 사진 속 자리 — 사진 위에 번역 덮기 (2026-11-25). 상자를 못 받으면 없음 */
  rows?: OcrRow[];
}

/** 사진 픽셀 기준 글자 줄 자리: 가운데·폭·높이·기울기(라디안). 사진 안 좌표일 뿐 위치 정보가 아니다 */
export interface OcrBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  a: number;
}
export interface OcrRow {
  text: string;
  box?: OcrBox;
}

/** 글만 번역 (영수증 품목 이름, 2026-11-25 — ADR-0012 추가): 한 번에 줄 수 상한 */
export const TRANSLATE_TEXT_MAX_LINES = 60;
/** 한 사람 하루 글 번역 횟수 */
export const TRANSLATE_TEXT_DAILY = 40;

/** 한 사람 하루 영수증 분석 한도 (사용자 확인 2026-11-11) */
export const OCR_DAILY_LIMIT = 20;
/** 보내는 사진 상한 — 기기에서 약 1600px JPEG로 줄여 보낸다 (Google 요청 본문 상한 10MB보다 넉넉히 작게) */
export const OCR_MAX_BYTES = 4 * 1024 * 1024;
