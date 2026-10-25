import * as z from 'zod/mini';
import { isLocalDate, toEpochDay } from '../date/localDate';
import {
  baseFields,
  CoordsSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocalDateSchema,
  LocalTimeSchema,
  nonEmpty,
} from './common';

// 엔티티 정의: docs/04-data-model.md §3 (가계부 엔티티는 범위 제외)

/**
 * 여행 목적지. 도시·국가를 고르면 국가 코드·좌표·시간대가 함께 저장되어
 * 지도 중심, 장소 검색 범위, 추천 기준, 국내/해외 판단에 쓰인다.
 * custom = 목록에 없어 직접 입력한 이름 (좌표 없음)
 */
export const DestinationSchema = z.object({
  name: nonEmpty(60),
  kind: z.enum(['city', 'country', 'custom']),
  /** ISO 3166-1 alpha-2 (KR, JP …) */
  countryCode: z.optional(z.string().check(z.regex(/^[A-Z]{2}$/))),
  coords: z.optional(CoordsSchema),
  timezone: z.optional(z.string()),
});
export type Destination = z.infer<typeof DestinationSchema>;

export const TripSchema = z
  .object({
    ...baseFields,
    title: nonEmpty(60),
    destinations: z.array(DestinationSchema).check(z.maxLength(10)),
    startDate: LocalDateSchema,
    endDate: LocalDateSchema,
    /** IANA 타임존 (예: Asia/Tokyo) */
    timezone: z.string().check(z.minLength(1)),
    cover: z.object({
      emoji: z.optional(z.string().check(z.maxLength(8))),
      color: z.optional(z.string().check(z.regex(/^#[0-9A-Fa-f]{6}$/))),
    }),
    /** 앱 안 지도 (H1: auto = 국내 네이버 / 해외 구글) */
    mapProvider: z.optional(z.enum(['auto', 'naver', 'google'])),
    memo: z.optional(z.string().check(z.maxLength(2000))),
    archivedAt: z.optional(IsoDateTimeSchema),
  })
  .check(
    // 날짜 형식 오류는 각 필드에서 따로 알리므로 여기서는 둘 다 올바를 때만 비교
    z.refine(
      (t) =>
        !isLocalDate(t.startDate) ||
        !isLocalDate(t.endDate) ||
        toEpochDay(t.endDate) >= toEpochDay(t.startDate),
      {
        message: '종료일은 시작일과 같거나 뒤여야 해요',
        path: ['endDate'],
      },
    ),
  );
export type Trip = z.infer<typeof TripSchema>;

export const ITEM_KINDS = [
  'place',
  'food',
  'cafe',
  'shopping',
  'transport',
  'lodging',
  'activity',
  'note',
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const PlaceRefSchema = z.object({
  name: z.optional(z.string().check(z.maxLength(100))),
  address: z.optional(z.string().check(z.maxLength(200))),
  coords: z.optional(CoordsSchema),
  coordsSource: z.optional(z.enum(['user', 'google', 'naver', 'kakao'])),
  /** google 좌표는 30일이 지나면 다시 받는다 (Google 약관, docs/10 §2.1) */
  coordsFetchedAt: z.optional(IsoDateTimeSchema),
  googlePlaceId: z.optional(z.string()),
  naverPlaceUrl: z.optional(z.url()),
  externalUrl: z.optional(z.url()),
});

export const ItineraryItemSchema = z.object({
  ...baseFields,
  tripId: IdSchema,
  /** null = 아직 날짜를 정하지 않은 '가고 싶은 곳' */
  date: z.nullable(LocalDateSchema),
  /** 같은 날짜 안 정렬 키 (fractionalIndex) */
  order: z.string().check(z.minLength(1)),
  kind: z.enum(ITEM_KINDS),
  title: nonEmpty(100),
  startTime: z.optional(LocalTimeSchema),
  endTime: z.optional(LocalTimeSchema),
  timezone: z.optional(z.string()),
  place: z.optional(PlaceRefSchema),
  transport: z.optional(
    z.object({
      mode: z.enum(['walk', 'subway', 'bus', 'train', 'taxi', 'car', 'ferry', 'flight', 'other']),
      from: z.optional(z.string().check(z.maxLength(100))),
      to: z.optional(z.string().check(z.maxLength(100))),
    }),
  ),
  bookingId: z.optional(IdSchema),
  url: z.optional(z.url()),
  memo: z.optional(z.string().check(z.maxLength(2000))),
  /** 여행 중 "다녀옴" 체크 */
  done: z.optional(z.boolean()),
});
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;

const BookingPointSchema = z.object({
  date: LocalDateSchema,
  time: z.optional(LocalTimeSchema),
  timezone: z.optional(z.string()),
  place: z.optional(z.string().check(z.maxLength(100))),
});

export const BookingSchema = z.object({
  ...baseFields,
  tripId: IdSchema,
  // transfer = 공항 픽업·드랍 (2026-10-25 추가)
  kind: z.enum([
    'flight',
    'lodging',
    'restaurant',
    'train',
    'car',
    'transfer',
    'tour',
    'ticket',
    'other',
  ]),
  title: nonEmpty(100),
  confirmationNo: z.optional(z.string().check(z.maxLength(60))),
  provider: z.optional(z.string().check(z.maxLength(60))),
  start: BookingPointSchema,
  end: z.optional(BookingPointSchema),
  details: z.optional(
    z.object({
      flightNo: z.optional(z.string().check(z.maxLength(20))),
      seat: z.optional(z.string().check(z.maxLength(20))),
      /** 항공: 출발 터미널 */
      terminal: z.optional(z.string().check(z.maxLength(20))),
      /** 항공: 도착 터미널 (2026-10-24 추가, 없어도 됨) */
      arrivalTerminal: z.optional(z.string().check(z.maxLength(20))),
      address: z.optional(z.string().check(z.maxLength(200))),
      phone: z.optional(z.string().check(z.maxLength(40))),
      roomType: z.optional(z.string().check(z.maxLength(60))),
      /** 숙소 조식 포함 (2026-10-26 추가) — breakfastDates가 없으면 모든 아침 */
      breakfast: z.optional(z.boolean()),
      /** 조식이 있는 아침 날짜 (체크인 다음 날 ~ 체크아웃 날 중) */
      breakfastDates: z.optional(z.array(LocalDateSchema).check(z.maxLength(60))),
      /** 음식점·픽업 예약 인원 */
      partySize: z.optional(z.number().check(z.gte(1), z.lte(99))),
      /** 픽업(공항 → 숙소) / 드랍(숙소 → 공항) */
      direction: z.optional(z.enum(['pickup', 'drop'])),
    }),
  ),
  /** "결제 완료 ₩320,000" 같은 자유 메모 (금액 계산 없음) */
  priceNote: z.optional(z.string().check(z.maxLength(100))),
  /** 일정표에 처음 한 번 넣은 시각 (2026-10-26) — 있으면 다시 넣지 않는다 */
  plannedAt: z.optional(IsoDateTimeSchema),
  memo: z.optional(z.string().check(z.maxLength(2000))),
});
export type Booking = z.infer<typeof BookingSchema>;

export const ChecklistItemSchema = z.object({
  ...baseFields,
  tripId: IdSchema,
  // essentials = 나라별 필수 항목 체크 (docs/19, 2026-10-25 추가 — text에 "나라:항목" 키)
  list: z.enum(['packing', 'todo', 'essentials']),
  category: z.optional(z.string().check(z.maxLength(30))),
  text: nonEmpty(100),
  checked: z.boolean(),
  order: z.string().check(z.minLength(1)),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const SavedPlaceSchema = z.object({
  ...baseFields,
  name: nonEmpty(100),
  kind: z.enum(ITEM_KINDS),
  address: z.optional(z.string().check(z.maxLength(200))),
  coords: z.optional(CoordsSchema),
  coordsSource: z.optional(z.enum(['user', 'google', 'naver', 'kakao'])),
  coordsFetchedAt: z.optional(IsoDateTimeSchema),
  googlePlaceId: z.optional(z.string()),
  naverPlaceUrl: z.optional(z.url()),
  cityTag: z.optional(z.string().check(z.maxLength(40))),
  memo: z.optional(z.string().check(z.maxLength(2000))),
});
export type SavedPlace = z.infer<typeof SavedPlaceSchema>;

/** 준비물·할 일 템플릿 (여행과 무관, 사용자가 이름 수정·추가·삭제) */
export const ChecklistTemplateSchema = z.object({
  ...baseFields,
  list: z.enum(['packing', 'todo']),
  name: nonEmpty(40),
  items: z
    .array(
      z.object({
        text: nonEmpty(100),
        category: z.optional(z.string().check(z.maxLength(30))),
      }),
    )
    .check(z.maxLength(300)),
  order: z.string().check(z.minLength(1)),
});
export type ChecklistTemplate = z.infer<typeof ChecklistTemplateSchema>;
