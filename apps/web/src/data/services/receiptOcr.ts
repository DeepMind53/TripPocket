import type { OcrResult } from '@trippocket/shared';
import { api } from '../api/client';

export type ReceiptText = { text: string; source: 'google' | 'azure' | 'device' };

/** 여행 나라에 맞춘 기기 인식 언어 (한국어·영어는 늘) */
export function deviceLangs(currency: string | undefined): string[] {
  const extra =
    currency === 'JPY'
      ? ['jpn']
      : currency === 'CNY'
        ? ['chi_sim']
        : currency === 'TWD' || currency === 'HKD'
          ? ['chi_tra']
          : [];
  return ['kor', 'eng', ...extra];
}

/**
 * 영수증 [분석] (ADR-0012, 누를 때만): 홈 서버 → Google Vision → Azure Read. 서버가 안 되거나(오프라인·한도·키 없음)
 * 실패하면 기기 안 Tesseract로. 사진은 서버에 저장되지 않고, 결과 글만 기기에 저장한다
 */
export async function readReceipt(image: Blob, currency: string | undefined): Promise<ReceiptText> {
  const res = await api<OcrResult>('/api/ocr', {
    method: 'POST',
    body: image,
    headers: { 'content-type': 'image/jpeg' },
  });
  if (res.ok && res.data.text.trim()) return { text: res.data.text, source: res.data.source };
  const { deviceOcr } = await import('./deviceOcr');
  return { text: await deviceOcr(image, deviceLangs(currency)), source: 'device' };
}
