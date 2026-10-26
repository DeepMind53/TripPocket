/**
 * 긴급 연락처 (실험실 "긴급 연락처 카드", 사용자 요청 2026-10-26). 앱에 넣어 오프라인에서도 보인다.
 * 2026-10-26에 아래 출처로 확인. 확인하지 못한 나라는 넣지 않는다 — 그 나라는 영사안전콜센터·외교부 링크만 보인다.
 * - 영사안전콜센터: 주미국·주중국 대사관, 주후쿠오카 총영사관 안내 (mofa.go.kr)
 * - 일본: 관광청(MLIT) 안내 자료 110·119, JNTO Japan Visitor Hotline (japan.travel/en/plan/hotline)
 * - 대만: 타오위안시 관광 FAQ(0800-011-765), 경찰 110·구급/소방 119 / 주타이베이 대표부 공지(mofa.go.kr/tw-ko)
 * - 태국: 태국 정부(thailand.go.th) 191, 캐나다 정부 여행 안내(travel.gc.ca) 1155·1669·199
 * - 베트남: 베트남 관광청(vietnam.travel) 113·114·115
 * - 필리핀: 내무자치부(DILG) 통합 911
 * - 중국: 광저우시 외국인 안내(gz.gov.cn) 110·120·119, 주중국 대사관 24시간 긴급전화
 * - 미국: 911 (카운티 정부 안내)
 * - EU: 유럽연합 집행위원회 112 (digital-strategy.ec.europa.eu/en/policies/112)
 * - 2026-10-27 추가: 싱가포르·홍콩·인도네시아·스위스·몽골·뉴질랜드·영국 (각 항목 위 출처)
 * - 공식 출처를 열지 못해 넣지 않음: 호주·캐나다·말레이시아·마카오·괌 (영사안전콜센터·외교부 링크만)
 */
export const EMERGENCY_CHECKED_AT = '2026-10-27';

/** 외교부 영사안전콜센터 (서울, 24시간, 해외에서 걸면 통화료) */
export const CONSULAR_CALL_CENTER = '+82-2-3210-0404';
/** 외교부 해외안전여행 (나라별 공관 연락처·안전 정보) */
export const MOFA_SAFETY_URL = 'https://www.0404.go.kr';

export type EmergencyKind =
  'police' | 'ambulance' | 'fire' | 'all' | 'touristPolice' | 'visitor' | 'embassy';

/** 24시간·한국어 가능 / 근무 시간·사건사고 내선 399(대만 대표부) / 24시간 사건사고 */
export type EmergencyNote = 'korean24h' | 'officeExt399' | 'incident24h';

export interface EmergencyLine {
  kind: EmergencyKind;
  number: string;
  /** 한 줄 메모 (선택) — 문구는 웹 i18n `emergency.note.*` */
  note?: EmergencyNote;
}

export interface CountryEmergency {
  country: string;
  lines: readonly EmergencyLine[];
}

const EU_112: readonly EmergencyLine[] = [{ kind: 'all', number: '112' }];
const EU = [
  'AT',
  'BE',
  'CZ',
  'DE',
  'DK',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'NL',
  'PL',
  'PT',
  'SE',
  'SI',
  'SK',
];

export const COUNTRY_EMERGENCY: readonly CountryEmergency[] = [
  {
    country: 'KR',
    lines: [
      { kind: 'police', number: '112' },
      { kind: 'ambulance', number: '119' },
    ],
  },
  {
    country: 'JP',
    lines: [
      { kind: 'police', number: '110' },
      { kind: 'ambulance', number: '119' },
      { kind: 'visitor', number: '050-3816-2787', note: 'korean24h' },
    ],
  },
  {
    country: 'TW',
    lines: [
      { kind: 'police', number: '110' },
      { kind: 'ambulance', number: '119' },
      { kind: 'visitor', number: '0800-011-765', note: 'korean24h' },
      { kind: 'embassy', number: '+886-2-2758-8320', note: 'officeExt399' },
    ],
  },
  {
    country: 'TH',
    lines: [
      { kind: 'touristPolice', number: '1155' },
      { kind: 'police', number: '191' },
      { kind: 'ambulance', number: '1669' },
      { kind: 'fire', number: '199' },
    ],
  },
  {
    country: 'VN',
    lines: [
      { kind: 'police', number: '113' },
      { kind: 'ambulance', number: '115' },
      { kind: 'fire', number: '114' },
    ],
  },
  { country: 'PH', lines: [{ kind: 'all', number: '911' }] },
  {
    country: 'CN',
    lines: [
      { kind: 'police', number: '110' },
      { kind: 'ambulance', number: '120' },
      { kind: 'fire', number: '119' },
      { kind: 'embassy', number: '+86-186-1173-0089', note: 'incident24h' },
    ],
  },
  { country: 'US', lines: [{ kind: 'all', number: '911' }] },
  // 2026-10-27 추가 — 싱가포르 정부 안내(gov.sg 비상 대비 자료)
  {
    country: 'SG',
    lines: [
      { kind: 'police', number: '999' },
      { kind: 'ambulance', number: '995' },
    ],
  },
  // 홍콩 특구 정부 HKEngage: 경찰·소방·구급 모두 999
  { country: 'HK', lines: [{ kind: 'all', number: '999' }] },
  // 인도네시아 관광청(indonesia.travel): 경찰 110·112, 구급 118·119
  {
    country: 'ID',
    lines: [
      { kind: 'police', number: '110' },
      { kind: 'ambulance', number: '118' },
      { kind: 'all', number: '112' },
    ],
  },
  // 스위스 연방 포털 ch.ch: 경찰 117, 구급 144, 소방 118, 유럽 공통 112
  {
    country: 'CH',
    lines: [
      { kind: 'police', number: '117' },
      { kind: 'ambulance', number: '144' },
      { kind: 'fire', number: '118' },
      { kind: 'all', number: '112' },
    ],
  },
  // 몽골 통신규제청(crc.gov.mn): 경찰 102, 구급 103, 소방 101
  {
    country: 'MN',
    lines: [
      { kind: 'police', number: '102' },
      { kind: 'ambulance', number: '103' },
      { kind: 'fire', number: '101' },
    ],
  },
  // 뉴질랜드 경찰(police.govt.nz): 경찰·소방·구급 111
  { country: 'NZ', lines: [{ kind: 'all', number: '111' }] },
  // 영국 정부(gov.uk): 999, 112도 됨
  {
    country: 'GB',
    lines: [
      { kind: 'all', number: '999' },
      { kind: 'all', number: '112' },
    ],
  },
  ...EU.map((country) => ({ country, lines: EU_112 })),
];

export const emergencyFor = (country: string | undefined): CountryEmergency | undefined =>
  country ? COUNTRY_EMERGENCY.find((c) => c.country === country) : undefined;

/** 전화 걸기 링크용: 숫자와 맨 앞 +만 남긴다 */
export const telHref = (number: string): string => `tel:${number.replace(/[^\d+]/g, '')}`;
