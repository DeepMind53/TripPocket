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
  /** 앱 안 지도: 자동(국내=네이버, 해외=구글) */
  inAppMap: 'auto' | 'naver' | 'google';
  timeStepMin: 5 | 10 | 15 | 30;
  dimPastItems: boolean;
  /** 0 = 끄기 */
  backupReminderDays: number;
  /** 환율 계산에 환전 수수료 반영 (현찰 살 때 추정) */
  fxFeeEnabled: boolean;
  /** 0 ~ 10%, 0.05 단위 */
  fxFeePercent: number;
  language: 'ko' | 'en';
  // ── 2026-10-24 사용자 선택으로 추가 ──
  /** 앱을 열면: 홈 / 진행 중인 여행의 일정 / 마지막으로 본 화면 */
  startScreen: 'home' | 'ongoing' | 'last';
  /** 날짜 표시: 10.27 (화) / 10월 27일 (화) */
  dateFormat: 'dot' | 'korean';
  /** 일정 화면을 열 때 지도를 펼쳐 둘지 */
  planMapOpen: boolean;
  /** ⚡ 빠른 메뉴 버튼 보이기 */
  quickButton: boolean;
  /** AI 추천을 열 때 처음 골라 둘 카테고리 */
  aiCats: ('food' | 'cafe' | 'play')[];
  /** AI 추천 기준 위치 처음 값: 가까운 역(현재 위치) / 숙소 / 직접 입력 */
  aiAnchor: 'coords' | 'lodging' | 'text';
}

export const SETTINGS_DEFAULTS: Settings = {
  theme: 'system',
  fontScale: 1,
  timeFormat: '24h',
  haptics: true,
  directionsApp: 'ask',
  travelMode: 'transit',
  inAppMap: 'auto',
  timeStepMin: 15,
  dimPastItems: true,
  backupReminderDays: 14,
  fxFeeEnabled: false,
  fxFeePercent: 1.75,
  language: 'ko',
  startScreen: 'home',
  dateFormat: 'dot',
  planMapOpen: false,
  quickButton: true,
  aiCats: ['food', 'cafe'],
  aiAnchor: 'text',
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
  inAppMap: oneOf('auto', 'naver', 'google'),
  timeStepMin: oneOf(5, 10, 15, 30),
  dimPastItems: (v): v is boolean => typeof v === 'boolean',
  backupReminderDays: (v): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 56 && v % 7 === 0,
  language: oneOf('ko', 'en'),
  startScreen: oneOf('home', 'ongoing', 'last'),
  dateFormat: oneOf('dot', 'korean'),
  planMapOpen: (v): v is boolean => typeof v === 'boolean',
  quickButton: (v): v is boolean => typeof v === 'boolean',
  aiCats: (v): v is Settings['aiCats'] =>
    Array.isArray(v) &&
    v.length <= 3 &&
    new Set(v).size === v.length &&
    v.every((x) => x === 'food' || x === 'cafe' || x === 'play'),
  aiAnchor: oneOf('coords', 'lodging', 'text'),
  fxFeeEnabled: (v): v is boolean => typeof v === 'boolean',
  fxFeePercent: (v): v is number =>
    typeof v === 'number' && v >= 0 && v <= 10 && Math.abs(Math.round(v * 20) - v * 20) < 1e-9,
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

/** 계정에 저장해 기기끼리 맞추는 설정 (나머지 전부) */
export const SYNCED_SETTINGS: readonly (keyof Settings)[] = (
  Object.keys(SETTINGS_DEFAULTS) as (keyof Settings)[]
).filter((k) => !DEVICE_SETTINGS.includes(k));

/** 계정에 올릴 부분만 (검사한 값) */
export function pickSynced(s: Settings): Partial<Settings> {
  return Object.fromEntries(SYNCED_SETTINGS.map((k) => [k, s[k]])) as Partial<Settings>;
}
