import { describe, expect, it } from 'vitest';
import { distanceKm, formatDistance, inKorea, walkMinutes } from './distance';

describe('다음 장소까지 거리 (실험실)', () => {
  it('서울역 → 시청역 약 1km, 도쿄역 → 신주쿠역 약 6km', () => {
    expect(
      distanceKm({ lat: 37.5547, lng: 126.9707 }, { lat: 37.5657, lng: 126.9769 }),
    ).toBeCloseTo(1.34, 1);
    expect(
      distanceKm({ lat: 35.6812, lng: 139.7671 }, { lat: 35.6896, lng: 139.7006 }),
    ).toBeCloseTo(6.07, 1);
  });

  it('도보 시간은 우회(×1.3)·시속 4.5km로 올림, 표시는 m/km', () => {
    expect(walkMinutes(1)).toBe(18);
    expect(walkMinutes(0.05)).toBe(1);
    expect(formatDistance(0.004)).toBe('10m');
    expect(formatDistance(0.456)).toBe('460m');
    expect(formatDistance(2.345)).toBe('2.3km');
  });

  it('국내 판단: 부산·울산·제주·울릉·독도는 국내, 후쿠오카·쓰시마·이키·시모노세키·고토는 해외', () => {
    const k = (lat: number, lng: number) => inKorea({ lat, lng });
    expect([
      k(37.57, 126.98),
      k(35.1, 129.04),
      k(35.54, 129.31),
      k(33.5, 126.53),
      k(37.48, 130.9),
      k(37.24, 131.87),
      k(34.88, 128.62),
    ]).toEqual([true, true, true, true, true, true, true]);
    expect([
      k(33.59, 130.4),
      k(34.2, 129.29),
      k(33.77, 129.72),
      k(33.96, 130.94),
      k(33.2, 129.05),
      k(35.68, 139.77),
    ]).toEqual([false, false, false, false, false, false]);
  });
});
