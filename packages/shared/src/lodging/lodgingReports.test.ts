import { describe, expect, it } from 'vitest';
import {
  hotelKeyFor,
  HotelKeySchema,
  LodgingReportInputSchema,
  nightlyOf,
  normalizeName,
} from './lodgingReports';

describe('숙소 가격 기록 (docs/28 §7)', () => {
  it('숙소 키: 아고다 id 우선, 아니면 흔한 말·기호를 뺀 이름|도시', () => {
    expect(hotelKeyFor('아무 이름', '도쿄', 706347)).toBe('agoda:706347');
    expect(hotelKeyFor('Hotel Gracery Shinjuku', 'Tokyo')).toBe('name:graceryshinjuku|tokyo');
    expect(hotelKeyFor('THE Gracery  Shinjuku!', 'tokyo')).toBe(
      hotelKeyFor('gracery shinjuku', 'Tokyo'),
    );
    expect(normalizeName('호텔 그레이스리 신주쿠')).toBe('그레이스리신주쿠');
    expect(HotelKeySchema.safeParse(hotelKeyFor('호텔 그레이스리 신주쿠')).success).toBe(true);
    expect(HotelKeySchema.safeParse('name:<script>|x').success).toBe(false);
  });

  it('입력 검사: 자유 글 없음, 범위 밖 값은 거절', () => {
    const ok = {
      hotelKey: 'agoda:706347',
      hotelName: '그레이스리',
      checkIn: '2026-11-24',
      nights: 3,
      adults: 2,
      rooms: 1,
      site: 'agoda',
      route: 'shinhan',
      price: 121300,
      priceType: 'nightly',
      currency: 'KRW',
      tax: 'incl',
      tags: ['member'],
    };
    expect(LodgingReportInputSchema.safeParse(ok).success).toBe(true);
    for (const bad of [
      { nights: 31 },
      { price: 0 },
      { price: 1.5 },
      { site: 'expedia' },
      { tags: ['memo'] },
      { currency: 'krw' },
      { route: 'a b' },
    ])
      expect(LodgingReportInputSchema.safeParse({ ...ok, ...bad }).success).toBe(false);
  });

  it('1박 가격: 총액은 박 수로 나눈다', () => {
    expect(nightlyOf({ price: 300000, priceType: 'total', nights: 3 })).toBe(100000);
    expect(nightlyOf({ price: 90000, priceType: 'nightly', nights: 3 })).toBe(90000);
  });
});
