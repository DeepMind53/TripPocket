import { describe, expect, it } from 'vitest';
import { isOutsideHours, rankPlaces, type PlaceSummary } from './placeSearch';

const p = (
  name: string,
  source: PlaceSummary['source'],
  lat = 35.7,
  lng = 139.7,
): PlaceSummary => ({
  source,
  id: `${source}-${name}`,
  name,
  address: '',
  coords: { lat, lng },
});

describe('장소 검색 결과 정리', () => {
  it('비슷한 순, 같은 곳(같은 이름·가까움)은 하나로', () => {
    const ranked = rankPlaces('이치란', [
      p('라멘 이치란 신주쿠점', 'kakao'),
      p('이치란', 'naver'),
      p('이치란', 'google', 35.7001, 139.7001),
      p('이치란 시부야', 'naver', 35.66, 139.7),
      p('전혀 다른 곳', 'kakao'),
    ]);
    expect(ranked.map((r) => [r.name, r.source])).toEqual([
      ['이치란', 'naver'],
      ['이치란 시부야', 'naver'],
      ['라멘 이치란 신주쿠점', 'kakao'],
      ['전혀 다른 곳', 'kakao'],
    ]);
  });

  it('영업시간 밖 경고: 휴무일, 밤을 넘기는 영업, 정보 없음', () => {
    const periods = [
      { day: 1, open: '10:00', close: '22:00' },
      { day: 5, open: '18:00', close: '02:00' },
    ];
    expect(isOutsideHours(periods, 1, '09:30')).toBe(true);
    expect(isOutsideHours(periods, 1, '12:00')).toBe(false);
    expect(isOutsideHours(periods, 2, '12:00')).toBe(true); // 화요일 휴무
    expect(isOutsideHours(periods, 5, '23:30')).toBe(false);
    expect(isOutsideHours(undefined, 1, '12:00')).toBeNull();
  });
});
