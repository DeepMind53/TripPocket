import { afterEach, expect, it } from 'vitest';
import { mountNaver } from './naverMap';

afterEach(() => {
  delete (window as unknown as { naver?: unknown }).naver;
});

it('네이버 지도가 칸을 position: relative로 바꿔도 absolute로 되돌린다 (높이 0 방지)', async () => {
  class FakeMap {
    constructor(el: HTMLElement) {
      el.style.position = 'relative';
    }
  }
  class FakeLatLng {}
  (window as unknown as { naver: unknown }).naver = {
    maps: { Map: FakeMap, LatLng: FakeLatLng },
  };
  const el = document.createElement('div');
  await mountNaver(el, { center: { lat: 37.5, lng: 127 }, zoom: 12 }, 'key');
  expect(el.style.position).toBe('absolute');
});
