import { describe, expect, it } from 'vitest';
import { sunTimes } from './sun';

const min = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
const near = (got: string, want: string) =>
  expect(Math.abs(min(got) - min(want))).toBeLessThanOrEqual(3);

describe('일출·일몰', () => {
  it('서울 2026-10-27 ≈ 06:52 / 17:41 (±3분)', () => {
    const s = sunTimes('2026-10-27', { lat: 37.57, lng: 126.98 }, 'Asia/Seoul')!;
    near(s.rise, '06:52');
    near(s.set, '17:41');
  });
  it('도쿄 하지 ≈ 04:25 / 19:00', () => {
    const s = sunTimes('2026-06-21', { lat: 35.68, lng: 139.69 }, 'Asia/Tokyo')!;
    near(s.rise, '04:25');
    near(s.set, '19:00');
  });
  it('뉴욕 (서쪽 경도·서머타임) 2026-07-01 ≈ 05:28 / 20:31', () => {
    const s = sunTimes('2026-07-01', { lat: 40.71, lng: -74.01 }, 'America/New_York')!;
    near(s.rise, '05:28');
    near(s.set, '20:31');
  });
  it('백야면 없음', () => {
    expect(sunTimes('2026-06-21', { lat: 78.2, lng: 15.6 }, 'Arctic/Longyearbyen')).toBeNull();
  });
});
