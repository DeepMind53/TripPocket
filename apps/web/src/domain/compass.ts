import type { LatLng } from '@trippocket/shared';

/**
 * 숙소 방향 (실험실 homeCompass, 2026-11-13): 지금 위치 → 숙소 방위각(북쪽 0°, 시계 방향).
 * 좌표는 기기 안에서만 계산하고 어디에도 보내거나 저장하지 않는다
 */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const rad = Math.PI / 180;
  const φ1 = from.lat * rad;
  const φ2 = to.lat * rad;
  const Δλ = (to.lng - from.lng) * rad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/** 화살표를 돌릴 각도: 숙소 방위각 − 휴대폰이 보는 방향 (0~360) */
export const arrowDeg = (bearing: number, heading: number) => (bearing - heading + 360) % 360;
