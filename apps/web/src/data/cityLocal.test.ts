import { describe, expect, it } from 'vitest';
import { CITY_LOCAL, cityLocalFor } from './cityLocal';
import { transitCardsByIds } from './transitCards';

describe('도시별 현지 생활 정보', () => {
  it('좌표가 반경 안이면 그 도시, 이름으로도, 나라가 다르면 아님', () => {
    expect(
      cityLocalFor({ name: '신주쿠', countryCode: 'JP', coords: { lat: 35.69, lng: 139.7 } })?.id,
    ).toBe('tokyo');
    expect(
      cityLocalFor({ name: 'Hoi An', countryCode: 'VN', coords: { lat: 15.88, lng: 108.33 } })?.id,
    ).toBe('danang');
    expect(cityLocalFor({ name: '오사카', countryCode: 'JP' })?.id).toBe('osaka');
    expect(cityLocalFor({ name: 'Taipei City', countryCode: 'TW' })?.id).toBe('taipei');
    expect(cityLocalFor({ name: '오사카', countryCode: 'KR' })).toBeNull();
    // 목록에 없는 도시 → null (나라 대표 정보로)
    expect(
      cityLocalFor({ name: '가나자와', countryCode: 'JP', coords: { lat: 36.56, lng: 136.66 } }),
    ).toBeNull();
  });

  it('1차 30곳 · 모든 도시에 카드·결제·교통수단·공식 링크, 카드 id는 사진 목록에 있다', () => {
    expect(CITY_LOCAL).toHaveLength(30);
    expect(new Set(CITY_LOCAL.map((c) => c.id)).size).toBe(30);
    for (const c of CITY_LOCAL) {
      expect(c.card && c.pay && c.modes.length && c.url.startsWith('https://'), c.id).toBeTruthy();
      if (c.cards) expect(transitCardsByIds(c.cards), c.id).toHaveLength(c.cards.length);
    }
  });
});
