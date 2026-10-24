import { describe, expect, it } from 'vitest';
import { placeKeyOf, ReviewInputSchema, summarizeReviews } from './reviews';

describe('후기 (docs/17)', () => {
  it('장소 키: Google id → 카카오 id → 네이버 이름+좌표, 직접 입력은 없음', () => {
    expect(placeKeyOf({ googlePlaceId: 'ChIJabc', name: 'a' })).toBe('g:ChIJabc');
    expect(placeKeyOf({ externalUrl: 'http://place.map.kakao.com/12345', name: 'a' })).toBe(
      'k:12345',
    );
    expect(
      placeKeyOf({ name: '이치란', coordsSource: 'naver', coords: { lat: 37.123456, lng: 127.5 } }),
    ).toBe('n:이치란|37.1235,127.5000');
    expect(placeKeyOf({ name: '그냥 적은 곳' })).toBeNull();
    expect(placeKeyOf(undefined)).toBeNull();
  });

  const base = {
    tripId: 't',
    itemId: 'i',
    kind: 'lodging',
    placeKey: 'g:ChIJabc',
    placeName: '호텔',
  } as const;
  it('입력 검사: 종합 필수, 그 종류 항목만, 별 1~5 정수', () => {
    expect(
      ReviewInputSchema.safeParse({ ...base, ratings: { overall: 5, location: 4 } }).success,
    ).toBe(true);
    expect(ReviewInputSchema.safeParse({ ...base, ratings: { location: 4 } }).success).toBe(false);
    expect(
      ReviewInputSchema.safeParse({ ...base, ratings: { overall: 5, taste: 4 } }).success,
    ).toBe(false);
    expect(ReviewInputSchema.safeParse({ ...base, ratings: { overall: 6 } }).success).toBe(false);
    expect(ReviewInputSchema.safeParse({ ...base, ratings: { overall: 4.5 } }).success).toBe(false);
    expect(
      ReviewInputSchema.safeParse({ ...base, placeKey: 'x:1', ratings: { overall: 5 } }).success,
    ).toBe(false);
    expect(
      ReviewInputSchema.safeParse({ ...base, placeKey: null, ratings: { overall: 5 } }).success,
    ).toBe(true);
  });

  it('항목별 평균', () => {
    expect(
      summarizeReviews([{ ratings: { overall: 5, price: 3 } }, { ratings: { overall: 4 } }]),
    ).toEqual({ count: 2, averages: { overall: 4.5, price: 3 } });
  });
});
