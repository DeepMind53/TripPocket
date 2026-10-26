import { describe, expect, it } from 'vitest';
import { dayRouteUrl } from './dayRoute';

const p = (lat: number, lng: number) => ({
  kind: 'place' as const,
  place: { name: 'x', coords: { lat, lng } },
});

describe('하루 동선', () => {
  it('좌표 있는 장소를 순서대로 출발 → 경유 → 도착', () => {
    const url = new URL(
      dayRouteUrl([p(35.71, 139.79), { kind: 'note' as const }, p(35.66, 139.7), p(35.69, 139.7)])!,
    );
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('origin')).toBe('35.71,139.79');
    expect(url.searchParams.get('waypoints')).toBe('35.66,139.7');
    expect(url.searchParams.get('destination')).toBe('35.69,139.7');
    expect(url.searchParams.get('travelmode')).toBe('transit');
  });
  it('2곳보다 적으면 없음, 10곳 넘으면 앞 9곳 + 마지막', () => {
    expect(dayRouteUrl([p(1, 1)])).toBeNull();
    const many = Array.from({ length: 12 }, (_, i) => p(i, i));
    const url = new URL(dayRouteUrl(many)!);
    expect(url.searchParams.get('waypoints')!.split('|')).toHaveLength(8);
    expect(url.searchParams.get('destination')).toBe('11,11');
  });
});
