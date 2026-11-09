import { afterEach, expect, it } from 'vitest';
import { mountNaver } from './naverMap';

afterEach(() => {
  delete (window as unknown as { naver?: unknown }).naver;
});

it('네이버 지도가 칸을 position: relative로 바꿔도 absolute로 되돌린다 (높이 0 방지), 확대 버튼은 작은 모양', async () => {
  let options: Record<string, unknown> = {};
  class FakeMap {
    constructor(el: HTMLElement, opts: Record<string, unknown>) {
      el.style.position = 'relative';
      options = opts;
    }
  }
  class FakeLatLng {}
  (window as unknown as { naver: unknown }).naver = {
    maps: {
      Map: FakeMap,
      LatLng: FakeLatLng,
      ZoomControlStyle: { LARGE: 1, SMALL: 2 },
      Position: { TOP_RIGHT: 3 },
    },
  };
  const el = document.createElement('div');
  await mountNaver(el, { center: { lat: 37.5, lng: 127 }, zoom: 12 }, 'key');
  expect(el.style.position).toBe('absolute');
  // 긴 막대(LARGE)는 작은 지도에서 가려진다 (사용자 제보 2026-11-09)
  expect(options.zoomControlOptions).toEqual({ style: 2, position: 3 });
});
