import { describe, expect, it } from 'vitest';
import { CITY_LOCAL, cityLocalFor } from './cityLocal';
import { transitCardsByIds } from './transitCards';

const at = (countryCode: string, lat: number, lng: number) =>
  cityLocalFor({ name: 'x', countryCode, coords: { lat, lng } })?.id ?? null;

describe('도시별 현지 생활 정보', () => {
  it('좌표가 반경 안이면 그 도시, 이름으로도, 나라가 다르면 아님', () => {
    expect(at('JP', 35.69, 139.7)).toBe('tokyo');
    expect(at('VN', 15.88, 108.33)).toBe('danang');
    expect(cityLocalFor({ name: '오사카', countryCode: 'JP' })?.id).toBe('osaka');
    expect(cityLocalFor({ name: 'Taipei City', countryCode: 'TW' })?.id).toBe('taipei');
    expect(cityLocalFor({ name: '오사카', countryCode: 'KR' })).toBeNull();
    // 목록에 없는 도시 → null (나라 대표 정보로)
    expect(at('JP', 34.97, 138.38)).toBeNull();
    // 가까운 두 도시는 더 가까운 쪽 (요코하마 ↔ 도쿄, 고베 ↔ 오사카)
    expect(at('JP', 35.45, 139.63)).toBe('yokohama');
    expect(at('JP', 34.69, 135.2)).toBe('kobe');
    // 나라가 다르면 가까워도 아님 (선전 좌표라도 홍콩 목적지면 홍콩)
    expect(at('HK', 22.4, 114.1)).toBe('hongkong');
    expect(at('CN', 22.54, 114.06)).toBe('shenzhen');
  });

  it('100곳 · 겹치지 않고, 모든 도시에 카드·결제·교통수단·공식 링크, 카드 id는 사진 목록에 있다', () => {
    expect(CITY_LOCAL).toHaveLength(100);
    expect(new Set(CITY_LOCAL.map((c) => c.id)).size).toBe(100);
    expect(new Set(CITY_LOCAL.map((c) => c.name)).size).toBe(100);
    for (const c of CITY_LOCAL) {
      expect(c.card && c.pay && c.modes.length && c.url.startsWith('https://'), c.id).toBeTruthy();
      if (c.cards) expect(transitCardsByIds(c.cards), c.id).toHaveLength(c.cards.length);
      // 도시 중심이 자기 도시로 찾아진다 (반경이 겹쳐도 가장 가까운 도시)
      expect(at(c.country, c.center.lat, c.center.lng), c.id).toBe(c.id);
    }
  });
});
