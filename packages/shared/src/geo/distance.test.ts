import { distanceKm, formatDistance, walkMinutes } from './distance';

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
});
