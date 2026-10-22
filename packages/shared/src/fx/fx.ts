/**
 * 환율 (docs/12 §2) — 조회·계산만, 금액은 저장하지 않는다 (가계부 제외).
 * 환율 값 = 그 통화 1단위가 몇 원인가 (KRW per 1 unit). 수출입은행의 JPY(100) 같은 100단위는 1단위로 바꿔 저장
 */
export interface FxSnapshot {
  source: 'koreaexim' | 'currency-api';
  /** 고시일 YYYY-MM-DD */
  date: string;
  fetchedAt: string;
  rates: Record<string, number>;
}

/** 나라 → 통화 (여행지 데이터에 있는 나라들). 없으면 USD로 보여 주지 않고 선택하게 한다 */
export const COUNTRY_CURRENCY: Record<string, string> = {
  KR: 'KRW',
  JP: 'JPY',
  CN: 'CNY',
  TW: 'TWD',
  HK: 'HKD',
  MO: 'MOP',
  MN: 'MNT',
  TH: 'THB',
  VN: 'VND',
  PH: 'PHP',
  SG: 'SGD',
  MY: 'MYR',
  ID: 'IDR',
  KH: 'KHR',
  LA: 'LAK',
  MM: 'MMK',
  BN: 'BND',
  IN: 'INR',
  NP: 'NPR',
  LK: 'LKR',
  BT: 'BTN',
  MV: 'MVR',
  BD: 'BDT',
  PK: 'PKR',
  KZ: 'KZT',
  KG: 'KGS',
  UZ: 'UZS',
  AZ: 'AZN',
  GE: 'GEL',
  AM: 'AMD',
  AE: 'AED',
  QA: 'QAR',
  SA: 'SAR',
  KW: 'KWD',
  BH: 'BHD',
  OM: 'OMR',
  JO: 'JOD',
  IL: 'ILS',
  TR: 'TRY',
  EG: 'EGP',
  MA: 'MAD',
  KE: 'KES',
  TZ: 'TZS',
  ZA: 'ZAR',
  MU: 'MUR',
  US: 'USD',
  GU: 'USD',
  MP: 'USD',
  PW: 'USD',
  CA: 'CAD',
  MX: 'MXN',
  CU: 'CUP',
  BR: 'BRL',
  AR: 'ARS',
  CL: 'CLP',
  PE: 'PEN',
  BO: 'BOB',
  AU: 'AUD',
  NZ: 'NZD',
  FJ: 'FJD',
  NC: 'XPF',
  PF: 'XPF',
  GB: 'GBP',
  IE: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  PT: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  EE: 'EUR',
  LV: 'EUR',
  LT: 'EUR',
  SI: 'EUR',
  HR: 'EUR',
  MT: 'EUR',
  ME: 'EUR',
  CH: 'CHF',
  CZ: 'CZK',
  HU: 'HUF',
  PL: 'PLN',
  RO: 'RON',
  BG: 'BGN',
  DK: 'DKK',
  SE: 'SEK',
  NO: 'NOK',
  IS: 'ISK',
  RU: 'RUB',
};

/** 자주 쓰는 통화 (목록 맨 위) */
export const POPULAR_CURRENCIES = [
  'JPY',
  'USD',
  'EUR',
  'CNY',
  'TWD',
  'THB',
  'VND',
  'PHP',
  'HKD',
  'SGD',
];

/** 원화로 보여 줄 때 "¥100 = 912원"처럼 100단위가 익숙한 통화 */
export const HUNDRED_UNIT = new Set(['JPY', 'IDR', 'VND', 'KHR', 'LAK', 'MMK', 'MNT', 'UZS']);

/** 금액(외화) → 원화. 수수료율(%)을 주면 "현찰 살 때(추정)" = 매매기준율 × (1 + 수수료) */
export function toKrw(amount: number, rate: number, feePercent = 0): number {
  return amount * rate * (1 + feePercent / 100);
}

export function fromKrw(krw: number, rate: number, feePercent = 0): number {
  return krw / (rate * (1 + feePercent / 100));
}

/** 수출입은행 응답 한 줄 → [통화, 1단위 원화]. "JPY(100)"·"1,377.5" 처리, 원화·잘못된 값은 null */
export function parseEximRow(curUnit: string, dealBasR: string): [string, number] | null {
  const m = /^([A-Z]{3})(?:\((\d+)\))?$/.exec(curUnit.trim());
  const value = Number(dealBasR.replace(/,/g, ''));
  if (!m || m[1] === 'KRW' || !Number.isFinite(value) || value <= 0) return null;
  return [m[1]!, value / Number(m[2] ?? 1)];
}
