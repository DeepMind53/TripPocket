/**
 * 앱 설정 (docs/12 §3, §5). 지금 있는 기능의 항목만 — 장소·환율·AI·동기화 항목은 해당 단계에서 추가.
 * 저장값이 잘못됐으면 그 항목만 기본값으로 되돌린다 (parseSettings).
 */
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontScale: 0.9 | 1 | 1.15 | 1.3;
  timeFormat: '24h' | '12h';
  haptics: boolean;
  directionsApp: 'naver' | 'google' | 'kakao' | 'ask';
  travelMode: 'transit' | 'walk' | 'car';
  timeStepMin: 5 | 10 | 15 | 30;
  dimPastItems: boolean;
  /** 0 = 끄기 */
  backupReminderDays: number;
  language: 'ko' | 'en';
}

export const SETTINGS_DEFAULTS: Settings = {
  theme: 'system',
  fontScale: 1,
  timeFormat: '24h',
  haptics: true,
  directionsApp: 'ask',
  travelMode: 'transit',
  timeStepMin: 15,
  dimPastItems: true,
  backupReminderDays: 14,
  language: 'ko',
};

const oneOf =
  <T>(...values: readonly T[]) =>
  (v: unknown): v is T =>
    values.includes(v as T);

/** 항목별 검사 */
const VALID: { [K in keyof Settings]: (v: unknown) => v is Settings[K] } = {
  theme: oneOf('light', 'dark', 'system'),
  fontScale: oneOf(0.9, 1, 1.15, 1.3),
  timeFormat: oneOf('24h', '12h'),
  haptics: (v): v is boolean => typeof v === 'boolean',
  directionsApp: oneOf('naver', 'google', 'kakao', 'ask'),
  travelMode: oneOf('transit', 'walk', 'car'),
  timeStepMin: oneOf(5, 10, 15, 30),
  dimPastItems: (v): v is boolean => typeof v === 'boolean',
  backupReminderDays: (v): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 56 && v % 7 === 0,
  language: oneOf('ko', 'en'),
};

/** 저장된 값(무엇이든) → 올바른 설정. 모르는 키는 버리고, 틀린 값은 기본값 */
export function parseSettings(raw: unknown): Settings {
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const out = { ...SETTINGS_DEFAULTS };
  for (const key of Object.keys(VALID) as (keyof Settings)[]) {
    const v = src[key];
    if (VALID[key](v)) (out as Record<keyof Settings, unknown>)[key] = v;
  }
  return out;
}

/** 기기마다 따로 두는 설정 (동기화 안 함, docs/12 §3.4) */
export const DEVICE_SETTINGS: readonly (keyof Settings)[] = ['theme', 'fontScale', 'haptics'];
