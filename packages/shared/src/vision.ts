/**
 * 사진 기능 (실험실, ADR-0012 — 2026-11-11): 사진으로 번역 · 사진 속 장소 · 사진 분류.
 * 사진은 누를 때만 서버를 거쳐 Google(번역 글자는 Azure 백업)로 가고, 서버는 저장·기록하지 않는다
 */
export type VisionFeature = 'translate' | 'landmark' | 'labels';

/** 한 사람 하루 횟수 (분류는 여러 장을 한 번에 하므로 넉넉히) */
export const VISION_DAILY: Record<VisionFeature, number> = {
  translate: 20,
  landmark: 20,
  labels: 60,
};

export interface PhotoTranslation {
  /** 사진에서 읽은 줄과 한국어 (번역을 못 하면 ko = null) */
  lines: { text: string; ko: string | null }[];
  left: number;
}

export interface VisionNames {
  /** Google이 알아본 이름 (장소·분류 영어 이름)과 확신도 0~1 */
  names: { name: string; score: number }[];
  left: number;
}
