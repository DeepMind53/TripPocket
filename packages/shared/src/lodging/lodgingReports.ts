import * as z from 'zod/mini';

/**
 * 숙소 가격 기록 (docs/28 §7, ADR-0010): 사용자가 각 앱에서 본 가격을 적어 30일 동안 로그인한 모두가 본다.
 * 내 지출이 아니라 "본 가격 제보" — 예약·여행과 잇지 않는다. 누가 적었는지는 응답에 넣지 않는다
 */
export const LODGING_SITES = [
  'agoda',
  'tripcom',
  'yeogi',
  'nol',
  'booking',
  'google',
  'other',
] as const;
export type LodgingSite = (typeof LODGING_SITES)[number];

/** 선택 칩 (자유 글 없음) */
export const LODGING_TAGS = ['member', 'app_only', 'non_refundable', 'breakfast'] as const;
export type LodgingTag = (typeof LODGING_TAGS)[number];

export const REPORT_RULES = {
  keepDays: 30,
  /** 사람별 적기 한도 (Q6 확정: 넉넉하게) */
  perMinute: 10,
  perDay: 60,
  /** 같은 사람·숙소·날짜·인원·앱·경로를 이 시간 안에 다시 적으면 덮어쓴다 */
  overwriteMs: 3_600_000,
  /** 한 숙소의 30일 기록 상한 (넘으면 오래된 것부터) */
  perHotel: 300,
  /** 표 전체 상한 (디스크 보호) */
  total: 50_000,
  /** 목록 최대 줄 수 */
  listMax: 100,
  /** 1박 원화 환산 정상 범위 */
  nightlyKrwMin: 5_000,
  nightlyKrwMax: 20_000_000,
} as const;

/**
 * 같은 숙소를 묶는 열쇠 (docs/28 §5): 아고다 숙소 id를 알면 `agoda:<id>`,
 * 모르면 `name:<정규화 이름>|<정규화 도시>` — 대소문자·띄어쓰기·기호·흔한 말(호텔·hotel·the)을 빼고 비교
 */
export function hotelKeyFor(name: string, city?: string, agodaHid?: number): string {
  if (agodaHid && Number.isInteger(agodaHid) && agodaHid > 0) return `agoda:${agodaHid}`;
  // "호텔"처럼 흔한 말뿐이면 그 말을 남긴다 (열쇠가 비지 않게)
  const n =
    normalizeName(name) ||
    name
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  return `name:${n.slice(0, 100)}|${normalizeName(city ?? '').slice(0, 40)}`;
}

const COMMON_WORDS = /\b(the|hotel|hotels|resort|inn)\b|호텔|리조트/g;

export function normalizeName(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(COMMON_WORDS, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

const HOTEL_KEY_RE = /^(agoda:\d{1,12}|name:[\p{L}\p{N}]{1,100}\|[\p{L}\p{N}]{0,40})$/u;
export const HotelKeySchema = z.string().check(z.regex(HOTEL_KEY_RE));

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const int = (min: number, max: number) => z.number().check(z.int(), z.gte(min), z.lte(max));

/** 기록 적기 (POST /api/lodging/reports) */
export const LodgingReportInputSchema = z.object({
  hotelKey: HotelKeySchema,
  hotelName: z.string().check(z.minLength(1), z.maxLength(80)),
  city: z.optional(z.string().check(z.maxLength(40))),
  checkIn: z.string().check(z.regex(YMD)),
  nights: int(1, 30),
  adults: int(1, 8),
  rooms: int(1, 4),
  site: z.enum(LODGING_SITES),
  /** 아고다 경로 id (웹 domain/agodaRoutes.ts) */
  route: z.optional(z.string().check(z.regex(/^[A-Za-z0-9]{1,30}$/))),
  price: int(1, 1_000_000_000),
  priceType: z.enum(['nightly', 'total']),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  tax: z.enum(['incl', 'excl', 'unknown']),
  tags: z.array(z.enum(LODGING_TAGS)).check(z.maxLength(LODGING_TAGS.length)),
});
export type LodgingReportInput = z.infer<typeof LodgingReportInputSchema>;

/** 목록 한 줄. 본 시각은 날짜만 (Q10 확정), 작성자는 mine만 */
export interface LodgingReportView extends Omit<LodgingReportInput, 'city'> {
  id: string;
  city?: string;
  /** 본 날짜 YYYY-MM-DD (서버 시각 기준, 한국 날짜) */
  seenOn: string;
  mine: boolean;
}

/**
 * 구글 호텔 참고 가격 (docs/28 §4.3, B): 서버 메모리에만 6시간, 저장·공유하지 않는다.
 * 금액은 원화 정수, 예약처마다 가장 싼 1줄, 1박 가격 오름차순
 */
export interface HotelPriceView {
  source: string;
  nightlyKrw: number;
  totalKrw?: number;
  /** 숙소 공식 사이트 */
  official?: true;
}
export interface HotelPricesView {
  /** 구글이 고른 숙소 이름 (입력한 이름과 다를 수 있어 화면에 보여 준다) */
  name: string;
  prices: HotelPriceView[];
}
export const HOTEL_PRICE_RULES = { maxRows: 12, maxNights: 30, adultsMax: 8 } as const;

/** 1박 가격 (총액이면 박 수로 나눔, 반올림) */
export const nightlyOf = (r: Pick<LodgingReportInput, 'price' | 'priceType' | 'nights'>) =>
  r.priceType === 'total' ? Math.round(r.price / r.nights) : r.price;
