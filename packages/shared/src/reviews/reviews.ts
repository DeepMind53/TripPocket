import * as z from 'zod/mini';
import type { ItemKind, ItineraryItem } from '../schema/entities';

type PlaceRef = NonNullable<ItineraryItem['place']>;

/**
 * 후기 (docs/17): 종류별 별점 항목 + 기타 한마디. 웹·서버가 같은 목록으로 검사한다.
 * 항목을 더해도 옛 후기는 그대로 보인다 (없는 항목은 안 보일 뿐)
 */
export const REVIEW_ASPECTS = {
  lodging: ['overall', 'location', 'cleanliness', 'price', 'facility', 'service'],
  food: ['overall', 'taste', 'price', 'service', 'mood', 'cleanliness'],
  cafe: ['overall', 'taste', 'mood', 'price', 'comfort'],
  shopping: ['overall', 'price', 'selection', 'service', 'access'],
  place: ['overall', 'sights', 'crowd', 'price', 'access'],
  activity: ['overall', 'fun', 'price', 'safety', 'access'],
} as const satisfies Partial<Record<ItemKind, readonly string[]>>;

export type ReviewKind = keyof typeof REVIEW_ASPECTS;
export type ReviewAspect = (typeof REVIEW_ASPECTS)[ReviewKind][number];
export const REVIEW_KINDS = Object.keys(REVIEW_ASPECTS) as ReviewKind[];
export const isReviewKind = (k: string): k is ReviewKind => k in REVIEW_ASPECTS;

/** 장소에 연결된 후기 1개당 포인트 (사용자 결정 2026-10-25) */
export const REVIEW_POINTS = 100;
/** 하루에 포인트를 받는 후기 수 상한 (어뷰징 막기) */
export const DAILY_POINT_REVIEWS = 10;
export const REVIEW_NOTE_MAX = 500;

/**
 * 같은 장소를 알아보는 열쇠 (docs/17 §3): Google = place id, 카카오 = 장소 id, 네이버 = 이름 + 좌표.
 * 직접 입력(검색 안 함)이면 null — 후기는 쓸 수 있지만 포인트·공개는 연결한 뒤
 */
export function placeKeyOf(place: PlaceRef | undefined): string | null {
  if (!place) return null;
  if (place.googlePlaceId) return `g:${place.googlePlaceId}`;
  const kakao = /place\.map\.kakao\.com\/(\d+)/.exec(place.externalUrl ?? '');
  if (kakao) return `k:${kakao[1]}`;
  if (place.coordsSource === 'naver' && place.coords && place.name)
    return `n:${place.name.trim()}|${place.coords.lat.toFixed(4)},${place.coords.lng.toFixed(4)}`;
  return null;
}

const PLACE_KEY_RE = /^(g:[\w-]{4,300}|k:\d{1,20}|n:.{1,100}\|-?\d{1,3}\.\d{4},-?\d{1,3}\.\d{4})$/;

const Stars = z.number().check(z.int(), z.gte(1), z.lte(5));

/** 후기 올리기 (PUT /api/reviews) */
export const ReviewInputSchema = z
  .object({
    tripId: z.string().check(z.minLength(1), z.maxLength(64)),
    itemId: z.string().check(z.minLength(1), z.maxLength(64)),
    kind: z.enum(REVIEW_KINDS as [ReviewKind, ...ReviewKind[]]),
    placeKey: z.nullable(z.string().check(z.regex(PLACE_KEY_RE))),
    placeName: z.string().check(z.minLength(1), z.maxLength(100)),
    ratings: z.record(z.string(), Stars),
    note: z.optional(z.string().check(z.maxLength(REVIEW_NOTE_MAX))),
  })
  .check(
    z.refine(
      (v) =>
        typeof v.ratings.overall === 'number' &&
        Object.keys(v.ratings).every((a) =>
          (REVIEW_ASPECTS[v.kind] as readonly string[]).includes(a),
        ),
      '종합 별점은 꼭, 나머지는 이 종류의 항목만',
    ),
  );
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

/** 화면에 보여 주는 후기 */
export interface ReviewView {
  id: string;
  /** 닉네임 또는 "User#37" (닉네임 가리기·탈퇴) */
  author: string;
  mine: boolean;
  kind: ReviewKind;
  placeKey: string | null;
  placeName: string;
  ratings: Partial<Record<ReviewAspect, number>>;
  note?: string;
  visitedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  count: number;
  /** 항목별 평균 (소수 첫째 자리) */
  averages: Partial<Record<ReviewAspect, number>>;
}

/** 후기 목록 → 항목별 평균 */
export function summarizeReviews(list: readonly Pick<ReviewView, 'ratings'>[]): ReviewSummary {
  const sums: Record<string, { s: number; n: number }> = {};
  for (const r of list)
    for (const [a, v] of Object.entries(r.ratings)) {
      if (typeof v !== 'number') continue;
      const cur = (sums[a] ??= { s: 0, n: 0 });
      cur.s += v;
      cur.n += 1;
    }
  return {
    count: list.length,
    averages: Object.fromEntries(
      Object.entries(sums).map(([a, { s, n }]) => [a, Math.round((s / n) * 10) / 10]),
    ),
  };
}

/** 가린 이름 */
export const maskedName = (publicNo: number) => `User#${publicNo}`;
