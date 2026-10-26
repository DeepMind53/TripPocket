import type { DayWeather } from './weather';

/** 날씨 맞춤 준비물 제안 한 줄 (실험실 "날씨 맞춤 준비물", 2026-10-27) */
export interface PackingTip {
  text: string;
  category: '의류' | '기타' | '세면도구';
  /** 왜 제안했나: rain = 비·눈 n일, hot = 낮 최고 28° 이상, cold = 아침 최저 5° 이하 */
  reason: 'rain' | 'snow' | 'hot' | 'cold';
}

// WMO 날씨 코드 (Open-Meteo): 51~67·80~82·95~99 비, 71~77·85·86 눈
const isRain = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
const isSnow = (c: number) => (c >= 71 && c <= 77) || c === 85 || c === 86;

/**
 * 여행 날짜들의 예보(작년 기록 포함)로 챙길 것. 이미 준비물에 있는 것(이름에 포함)은 뺀다
 */
export function packingTips(days: readonly DayWeather[], have: readonly string[]): PackingTip[] {
  if (!days.length) return [];
  const tips: PackingTip[] = [];
  if (days.some((d) => isRain(d.code)))
    tips.push({ text: '우산', category: '기타', reason: 'rain' });
  if (days.some((d) => isSnow(d.code)))
    tips.push({ text: '방수 신발', category: '의류', reason: 'snow' });
  if (days.some((d) => d.max >= 28)) {
    tips.push({ text: '선크림', category: '세면도구', reason: 'hot' });
    tips.push({ text: '모자', category: '의류', reason: 'hot' });
  }
  if (days.some((d) => d.min <= 5)) {
    tips.push({ text: '두꺼운 겉옷', category: '의류', reason: 'cold' });
    tips.push({ text: '장갑', category: '의류', reason: 'cold' });
  }
  const owned = have.map((h) => h.replace(/\s/g, ''));
  return tips.filter((tip) => !owned.some((h) => h.includes(tip.text.replace(/\s/g, ''))));
}
