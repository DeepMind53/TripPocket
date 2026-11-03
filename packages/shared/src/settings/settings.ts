/**
 * 앱 설정 (docs/12 §3, §5). 지금 있는 기능의 항목만 — 장소·환율·AI·동기화 항목은 해당 단계에서 추가.
 * 저장값이 잘못됐으면 그 항목만 기본값으로 되돌린다 (parseSettings).
 */
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontScale: 0.9 | 1 | 1.15 | 1.3;
  timeFormat: '24h' | '12h';
  haptics: boolean;
  /** 국내 길찾기 앱 — 해외는 늘 Google 지도 (2026-10-27). 예전 값 'google'은 기본값으로 */
  directionsApp: 'naver' | 'kakao' | 'ask';
  travelMode: 'transit' | 'walk' | 'car';
  /** 앱 안 국내 지도 (해외는 늘 Google, 2026-10-28). 예전 inAppMap 값은 parseSettings가 버림 */
  domesticMap: 'naver' | 'kakao' | 'ask';
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
  /** 일정 사이에 일출·일몰 시각 줄 (2026-10-27 실험실에서 정식) */
  sunTimes: boolean;
  /** 일정 사이 다음 장소까지 거리·걷는 시간 (2026-10-27 실험실에서 정식) */
  legDistance: boolean;
  /** 일정 줄 간격 좁게 (2026-10-27 실험실에서 정식, 기본 끔) */
  compactList: boolean;
  /** 그날 장소 1km 안의 가고 싶은 곳 알림 (2026-10-27 실험실에서 정식) */
  nearbyWish: boolean;
  /** 숙소 체크아웃 날 일정 맨 위에 체크아웃 시각 (2026-10-27 실험실에서 정식) */
  checkoutNotice: boolean;
  /** 오늘·지난 날 끝에 방문한 곳 수·이동 거리 (2026-10-27 실험실에서 정식) */
  dayRecap: boolean;
  /** 여행 중 일정 화면을 열면 진행 중인 일정으로 이동 (2026-10-27 실험실에서 정식) */
  nowScroll: boolean;
  /** 일정 시간 아래 날씨 주의 이모지 (2026-10-28 실험실에서 정식) */
  weatherMark: boolean;
  /** 출발 전 홈에 여행지 시차 (2026-10-28 실험실에서 정식) */
  jetLag: boolean;
  /** 일정 날짜 아래 현지 공휴일 (2026-10-28 실험실에서 정식) */
  localHoliday: boolean;
  /** 마지막 일정이 22시 이후면 늦은 귀가 안내 (2026-10-28 실험실에서 정식) */
  lateNight: boolean;
  /** 날짜별 대안 플랜(Plan B)·아침 컨디션 체크 (2026-11-03 실험실에서 정식) */
  planB: boolean;
  /** 사원·온천·해변·산 일정이 있는 날 챙길 것 (2026-11-03 실험실에서 정식) */
  placeTips: boolean;
  /** 예약 탭 위 숙소 없는 밤 안내 (2026-11-03 실험실에서 정식) */
  missingStay: boolean;
  /** 미세먼지·자외선이 나쁜 날 안내 (2026-11-03 실험실에서 정식) */
  airQuality: boolean;
  /** 홈 여행 카드 아래 여행지 소개(위키백과) (2026-11-03 실험실에서 정식) */
  cityIntro: boolean;
  /** 빠른 메뉴 대중교통 안내(요금·환승·앱) (2026-11-03 실험실에서 정식) */
  transitGuide: boolean;
  /** 빠른 메뉴 근처 찾기(편의점·약국·ATM·화장실) (2026-11-03 실험실에서 정식) */
  nearbyFind: boolean;
  /** 빠른 메뉴 공항 → 숙소 길찾기 (2026-11-03 실험실에서 정식) */
  arrivalRoute: boolean;
  /** ⚡ 빠른 메뉴 버튼 보이기 */
  quickButton: boolean;
  /** AI 추천을 열 때 처음 골라 둘 카테고리 */
  aiCats: ('food' | 'cafe' | 'play')[];
  /** AI 추천 기준 위치 처음 값: 가까운 역(현재 위치) / 숙소 / 직접 입력 */
  aiAnchor: 'coords' | 'lodging' | 'text';
  /** 기능 안내 팝업으로 이미 물어본 일정 기능 (계정별, 기능마다 한 번만) */
  planPromptSeen: PlanFeature[];
  /** 없으면 옛 설정 → 일정 기능을 모두 끄고 다시 묻는다 (사용자 결정 2026-11-02) */
  planPromptV: 1;
}

/** 설정 "일정"의 켜고 끄는 항목. 처음에는 모두 끔, 접속할 때 하나씩 묻는다 (2026-11-02) */
export const PLAN_FEATURES = [
  'dimPastItems',
  'planMapOpen',
  'sunTimes',
  'legDistance',
  'compactList',
  'nearbyWish',
  'checkoutNotice',
  'dayRecap',
  'nowScroll',
  'weatherMark',
  'jetLag',
  'localHoliday',
  'lateNight',
  'planB',
  'placeTips',
  'missingStay',
  'airQuality',
  'cityIntro',
  'transitGuide',
  'nearbyFind',
  'arrivalRoute',
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

/** 설정 "일정"을 나눈 묶음 (사용자 요청 2026-11-03 — 항목이 많아져 카테고리로) */
export const PLAN_FEATURE_GROUPS: readonly { id: string; keys: readonly PlanFeature[] }[] = [
  {
    id: 'view',
    keys: [
      'planMapOpen',
      'compactList',
      'dimPastItems',
      'nowScroll',
      'legDistance',
      'sunTimes',
      'planB',
    ],
  },
  {
    id: 'notice',
    keys: ['nearbyWish', 'checkoutNotice', 'lateNight', 'dayRecap', 'placeTips', 'missingStay'],
  },
  { id: 'local', keys: ['weatherMark', 'airQuality', 'localHoliday', 'jetLag', 'cityIntro'] },
  { id: 'quick', keys: ['transitGuide', 'nearbyFind', 'arrivalRoute'] },
];

/** 아직 묻지 않은 기능 중 무작위 하나, 다 물었으면 null */
export function nextPlanPrompt(
  seen: readonly string[],
  random: () => number = Math.random,
): PlanFeature | null {
  const left = PLAN_FEATURES.filter((f) => !seen.includes(f));
  return left[Math.floor(random() * left.length)] ?? null;
}

/** 물어본 기록 합치기 — 기기끼리 덮어써도 한 번 물은 기능을 또 묻지 않게 */
export function mergePlanSeen(a: readonly PlanFeature[], b: readonly PlanFeature[]): PlanFeature[] {
  return [...new Set([...a, ...b])];
}

export const SETTINGS_DEFAULTS: Settings = {
  theme: 'system',
  fontScale: 1,
  timeFormat: '24h',
  haptics: true,
  directionsApp: 'ask',
  travelMode: 'transit',
  domesticMap: 'naver',
  timeStepMin: 15,
  dimPastItems: false,
  backupReminderDays: 14,
  fxFeeEnabled: false,
  fxFeePercent: 1.75,
  language: 'ko',
  startScreen: 'home',
  dateFormat: 'dot',
  planMapOpen: false,
  sunTimes: false,
  legDistance: false,
  compactList: false,
  nearbyWish: false,
  checkoutNotice: false,
  dayRecap: false,
  nowScroll: false,
  weatherMark: false,
  jetLag: false,
  localHoliday: false,
  lateNight: false,
  planB: false,
  placeTips: false,
  missingStay: false,
  airQuality: false,
  cityIntro: false,
  transitGuide: false,
  nearbyFind: false,
  arrivalRoute: false,
  quickButton: true,
  aiCats: ['food', 'cafe'],
  aiAnchor: 'text',
  planPromptSeen: [],
  planPromptV: 1,
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
  directionsApp: oneOf('naver', 'kakao', 'ask'),
  travelMode: oneOf('transit', 'walk', 'car'),
  domesticMap: oneOf('naver', 'kakao', 'ask'),
  timeStepMin: oneOf(5, 10, 15, 30),
  dimPastItems: (v): v is boolean => typeof v === 'boolean',
  backupReminderDays: (v): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 56 && v % 7 === 0,
  language: oneOf('ko', 'en'),
  startScreen: oneOf('home', 'ongoing', 'last'),
  dateFormat: oneOf('dot', 'korean'),
  planMapOpen: (v): v is boolean => typeof v === 'boolean',
  sunTimes: (v): v is boolean => typeof v === 'boolean',
  legDistance: (v): v is boolean => typeof v === 'boolean',
  compactList: (v): v is boolean => typeof v === 'boolean',
  nearbyWish: (v): v is boolean => typeof v === 'boolean',
  checkoutNotice: (v): v is boolean => typeof v === 'boolean',
  dayRecap: (v): v is boolean => typeof v === 'boolean',
  nowScroll: (v): v is boolean => typeof v === 'boolean',
  weatherMark: (v): v is boolean => typeof v === 'boolean',
  jetLag: (v): v is boolean => typeof v === 'boolean',
  localHoliday: (v): v is boolean => typeof v === 'boolean',
  lateNight: (v): v is boolean => typeof v === 'boolean',
  planB: (v): v is boolean => typeof v === 'boolean',
  placeTips: (v): v is boolean => typeof v === 'boolean',
  missingStay: (v): v is boolean => typeof v === 'boolean',
  airQuality: (v): v is boolean => typeof v === 'boolean',
  cityIntro: (v): v is boolean => typeof v === 'boolean',
  transitGuide: (v): v is boolean => typeof v === 'boolean',
  nearbyFind: (v): v is boolean => typeof v === 'boolean',
  arrivalRoute: (v): v is boolean => typeof v === 'boolean',
  quickButton: (v): v is boolean => typeof v === 'boolean',
  aiCats: (v): v is Settings['aiCats'] =>
    Array.isArray(v) &&
    v.length <= 3 &&
    new Set(v).size === v.length &&
    v.every((x) => x === 'food' || x === 'cafe' || x === 'play'),
  aiAnchor: oneOf('coords', 'lodging', 'text'),
  planPromptSeen: (v): v is PlanFeature[] =>
    Array.isArray(v) && v.every((x) => (PLAN_FEATURES as readonly unknown[]).includes(x)),
  planPromptV: oneOf(1),
  fxFeeEnabled: (v): v is boolean => typeof v === 'boolean',
  fxFeePercent: (v): v is number =>
    typeof v === 'number' && v >= 0 && v <= 10 && Math.abs(Math.round(v * 20) - v * 20) < 1e-9,
};

/** 저장된 값(무엇이든) → 올바른 설정. 모르는 키는 버리고, 틀린 값은 기본값 */
export function parseSettings(raw: unknown): Settings {
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const out = { ...SETTINGS_DEFAULTS };
  const current = src.planPromptV === 1;
  for (const key of Object.keys(VALID) as (keyof Settings)[]) {
    if (!current && (PLAN_FEATURES as readonly string[]).includes(key)) continue;
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
