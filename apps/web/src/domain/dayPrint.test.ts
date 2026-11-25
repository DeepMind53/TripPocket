import type { ItineraryItem } from '@trippocket/shared';
import { mapPointsParam, weatherText } from './dayPrint';

it('날씨 한 줄: 예보 · 지난 날 실제 날씨 · 작년 같은 날 기록', () => {
  expect(weatherText({ code: 0, min: 11.6, max: 20.2 })).toBe('맑음 12°/20°');
  expect(weatherText({ code: 61, min: 8, max: 14, past: true })).toBe('비 8°/14° · 실제 날씨');
  expect(weatherText({ code: 3, min: 5, max: 12, year: 2025 })).toBe('흐림 5°/12° · 25년 같은 날');
  expect(weatherText(undefined)).toBeNull();
});

it('지도 점: 목록 번호 그대로, 좌표 없는 일정·메모는 빼고 번호는 건너뛴다', () => {
  const it0 = (id: string, kind: ItineraryItem['kind'], lat?: number) =>
    ({
      id,
      kind,
      title: id,
      ...(lat ? { place: { coords: { lat, lng: 139 } } } : {}),
    }) as ItineraryItem;
  expect(
    mapPointsParam([
      it0('a', 'place', 35.1),
      it0('m', 'note'),
      it0('b', 'activity'),
      it0('c', 'food', 35.2),
    ]),
  ).toBe('35.10000,139.00000,1;35.20000,139.00000,4');
  expect(mapPointsParam([it0('m', 'note')])).toBeNull();
});
