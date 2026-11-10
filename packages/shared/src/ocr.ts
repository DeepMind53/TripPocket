/**
 * 영수증 글자 인식 결과 (POST /api/ocr, ADR-0012 — 2026-11-11). 사진은 서버를 거쳐 가기만 하고 저장하지 않는다.
 * source: google = Cloud Vision, azure = Azure AI Vision Read. left = 오늘 남은 횟수 (한 사람 하루 20장)
 */
export interface OcrResult {
  text: string;
  source: 'google' | 'azure';
  left: number;
}

/** 한 사람 하루 영수증 분석 한도 (사용자 확인 2026-11-11) */
export const OCR_DAILY_LIMIT = 20;
/** 보내는 사진 상한 — 기기에서 약 1600px JPEG로 줄여 보낸다 (Google 요청 본문 상한 10MB보다 넉넉히 작게) */
export const OCR_MAX_BYTES = 4 * 1024 * 1024;
