import { loadScript, pinSvg } from './loadScript';
import type { LatLng, MapHandle, MapMarker, MapOptions } from './types';

/* Kakao Maps JavaScript API v2 — 필요한 부분만 직접 타입을 적는다 */
interface KLatLng {
  getLat(): number;
}
interface KMapsNs {
  load(cb: () => void): void;
  Map?: new (
    el: HTMLElement,
    opts: object,
  ) => {
    setBounds(b: unknown, top?: number, right?: number, bottom?: number, left?: number): void;
    setCenter(p: KLatLng): void;
    setLevel(l: number): void;
    panTo(p: KLatLng): void;
    relayout(): void;
  };
  LatLng: new (lat: number, lng: number) => KLatLng;
  LatLngBounds: new () => { extend(p: KLatLng): void };
  Marker: new (opts: object) => { setMap(m: unknown): void };
  MarkerImage: new (src: string, size: unknown, opts?: object) => unknown;
  Polyline: new (opts: object) => { setMap(m: unknown): void };
  Size: new (w: number, h: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  event: { addListener(target: unknown, ev: string, cb: () => void): void };
}
const kmaps = () => (window as unknown as { kakao?: { maps?: KMapsNs } }).kakao?.maps;

/** Google 확대 수준(zoom) → 카카오 지도 레벨 (작을수록 가깝다, 1~14) */
const levelOf = (zoom: number) => Math.min(14, Math.max(1, 19 - zoom));

/**
 * 국내 앱 안 지도 — 카카오 (사용자 요청 2026-10-28, 설정에서 네이버·카카오 중 고름).
 * JavaScript 키 — Pages 환경 변수 VITE_KAKAO_MAP_KEY (카카오 개발자 콘솔에 사이트 도메인 등록 필수)
 */
export async function mountKakao(
  el: HTMLElement,
  opts: MapOptions,
  appKey: string,
): Promise<MapHandle> {
  // autoload=false: 스크립트를 넣은 뒤 load()로 지도 모듈을 받는다
  await loadScript(
    `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`,
    () => typeof kmaps()?.load === 'function',
  );
  const k = kmaps()!;
  if (typeof k.Map !== 'function') await new Promise<void>((resolve) => k.load(resolve));
  const ll = (p: LatLng) => new k.LatLng(p.lat, p.lng);
  const map = new k.Map!(el, { center: ll(opts.center), level: levelOf(opts.zoom) });
  let markers: { setMap(m: unknown): void }[] = [];
  let lines: { setMap(m: unknown): void }[] = [];
  let onClick: (id: string) => void = () => {};

  return {
    setMarkers(list: readonly MapMarker[]) {
      markers.forEach((m) => m.setMap(null));
      markers = list.map((m) => {
        const marker = new k.Marker({
          map,
          position: ll(m.position),
          title: m.title,
          image: new k.MarkerImage(pinSvg(m.label, m.color), new k.Size(30, 30), {
            offset: new k.Point(15, 15),
          }),
          clickable: true,
        });
        k.event.addListener(marker, 'click', () => onClick(m.id));
        return marker;
      });
    },
    drawPaths(paths) {
      lines.forEach((l) => l.setMap(null));
      lines = paths
        .filter((p) => p.points.length > 1)
        .map(
          (p) =>
            new k.Polyline({
              map,
              path: p.points.map(ll),
              strokeColor: p.color,
              strokeOpacity: 0.8,
              strokeWeight: 3,
            }),
        );
    },
    fitBounds(points) {
      if (points.length === 0) return;
      if (points.length === 1) {
        map.setCenter(ll(points[0]!));
        map.setLevel(3);
        return;
      }
      const b = new k.LatLngBounds();
      points.forEach((p) => b.extend(ll(p)));
      map.setBounds(b, 40, 40, 40, 40);
    },
    panTo(p) {
      map.panTo(ll(p));
    },
    resize() {
      // 카카오 지도는 상자 크기가 바뀌면 relayout을 불러야 빈 곳 없이 다시 그린다
      map.relayout();
    },
    onMarkerClick(cb) {
      onClick = cb;
    },
    destroy() {
      markers.forEach((m) => m.setMap(null));
      lines.forEach((l) => l.setMap(null));
      el.replaceChildren();
    },
  };
}
