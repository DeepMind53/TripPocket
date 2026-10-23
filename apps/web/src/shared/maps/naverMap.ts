import { loadScript, pinSvg } from './loadScript';
import type { LatLng, MapHandle, MapMarker, MapOptions } from './types';

/* NAVER Maps JavaScript API v3 — 필요한 부분만 직접 타입을 적는다 */
interface NLatLng {
  lat(): number;
}
interface NMapsNs {
  Map: new (
    el: HTMLElement,
    opts: object,
  ) => {
    fitBounds(b: unknown, margin?: object): void;
    setCenter(p: NLatLng): void;
    setZoom(z: number): void;
  };
  LatLng: new (lat: number, lng: number) => NLatLng;
  LatLngBounds: new (sw: NLatLng, ne: NLatLng) => { extend(p: NLatLng): void };
  Marker: new (opts: object) => { setMap(m: unknown): void };
  Polyline: new (opts: object) => { setMap(m: unknown): void };
  Size: new (w: number, h: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  Event: { addListener(target: unknown, ev: string, cb: () => void): void };
}
const nmaps = () => (window as unknown as { naver?: { maps?: NMapsNs } }).naver?.maps;

/** 클라이언트 ID — Pages 환경 변수 VITE_NAVER_MAP_CLIENT_ID (NCP 콘솔에 웹 서비스 URL 등록) */
export async function mountNaver(
  el: HTMLElement,
  opts: MapOptions,
  clientId: string,
): Promise<MapHandle> {
  await loadScript(
    `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`,
    () => typeof nmaps()?.Map === 'function',
  );
  const n = nmaps()!;
  const ll = (p: LatLng) => new n.LatLng(p.lat, p.lng);
  const map = new n.Map(el, {
    center: ll(opts.center),
    zoom: opts.zoom,
    zoomControl: true,
    scaleControl: false,
    mapDataControl: false,
  });
  let markers: { setMap(m: unknown): void }[] = [];
  let lines: { setMap(m: unknown): void }[] = [];
  let onClick: (id: string) => void = () => {};

  return {
    setMarkers(list: readonly MapMarker[]) {
      markers.forEach((m) => m.setMap(null));
      markers = list.map((m) => {
        const marker = new n.Marker({
          map,
          position: ll(m.position),
          title: m.title,
          icon: {
            url: pinSvg(m.label, m.color),
            size: new n.Size(30, 30),
            scaledSize: new n.Size(30, 30),
            anchor: new n.Point(15, 15),
          },
        });
        n.Event.addListener(marker, 'click', () => onClick(m.id));
        return marker;
      });
    },
    drawPaths(paths) {
      lines.forEach((l) => l.setMap(null));
      lines = paths
        .filter((p) => p.points.length > 1)
        .map(
          (p) =>
            new n.Polyline({
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
        map.setZoom(16);
        return;
      }
      const b = new n.LatLngBounds(ll(points[0]!), ll(points[0]!));
      points.forEach((p) => b.extend(ll(p)));
      map.fitBounds(b, { top: 40, right: 40, bottom: 40, left: 40 });
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
