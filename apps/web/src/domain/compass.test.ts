import { describe, expect, it } from 'vitest';
import { arrowDeg, bearingDeg } from './compass';

describe('숙소 방향', () => {
  it('북·동·남·서 방위각과 화살표 각도', () => {
    const o = { lat: 35, lng: 139 };
    expect(Math.round(bearingDeg(o, { lat: 36, lng: 139 }))).toBe(0);
    expect(Math.round(bearingDeg(o, { lat: 35, lng: 140 }))).toBe(90);
    expect(Math.round(bearingDeg(o, { lat: 34, lng: 139 }))).toBe(180);
    expect(Math.round(bearingDeg(o, { lat: 35, lng: 138 }))).toBe(270);
    // 휴대폰이 동쪽(90°)을 보고 숙소가 북쪽이면 화살표는 왼쪽(270°)
    expect(arrowDeg(0, 90)).toBe(270);
  });
});
