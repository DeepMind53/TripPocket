import { loadScript, pinSvg } from './loadScript';
import type { LatLng, MapHandle, MapMarker, MapOptions } from './types';

/* Google Maps JavaScript API — 필요한 부분만 직접 타입을 적는다 (@types 패키지 없이) */
interface GLatLngBounds {
  extend(p: LatLng): void;
}
interface GMapsNs {
  Map: new (
    el: HTMLElement,
    opts: object,
  ) => {
    fitBounds(b: GLatLngBounds, pad?: number): void;
    setCenter(p: LatLng): void;
    setZoom(z: number): void;
  };
  Marker: new (opts: object) => {
    setMap(m: unknown): void;
    addListener(ev: string, cb: () => void): void;
  };
  Polyline: new (opts: object) => { setMap(m: unknown): void };
  LatLngBounds: new () => GLatLngBounds;
  Size: new (w: number, h: number) => unknown;
  Point: new (x: number, y: number) => unknown;
}
const gmaps = () =>
  (window as unknown as { google?: { maps?: GMapsNs & { Map?: unknown } } }).google?.maps;

/** 브라우저 키 — Cloudflare Pages 환경 변수 VITE_GOOGLE_MAPS_KEY (도메인·API 제한 필수, docs/10 §6.1) */
export async function mountGoogle(
  el: HTMLElement,
  opts: MapOptions,
  key: string,
): Promise<MapHandle> {
  await loadScript(
    `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=ko&region=KR`,
    () => typeof gmaps()?.Map === 'function',
  );
  const g = gmaps()!;
  const map = new g.Map(el, {
    center: opts.center,
    zoom: opts.zoom,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
  });
  let markers: { setMap(m: unknown): void }[] = [];
  let lines: { setMap(m: unknown): void }[] = [];
  let onClick: (id: string) => void = () => {};

  return {
    setMarkers(list: readonly MapMarker[]) {
      markers.forEach((m) => m.setMap(null));
      markers = list.map((m) => {
        const marker = new g.Marker({
          map,
          position: m.position,
          title: m.title,
          icon: {
            url: pinSvg(m.label, m.color),
            scaledSize: new g.Size(30, 30),
            anchor: new g.Point(15, 15),
          },
        });
        marker.addListener('click', () => onClick(m.id));
        return marker;
      });
    },
    drawPaths(paths) {
      lines.forEach((l) => l.setMap(null));
      lines = paths
        .filter((p) => p.points.length > 1)
        .map(
          (p) =>
            new g.Polyline({
              map,
              path: p.points,
              strokeColor: p.color,
              strokeOpacity: 0.8,
              strokeWeight: 3,
            }),
        );
    },
    fitBounds(points) {
      if (points.length === 0) return;
      if (points.length === 1) {
        map.setCenter(points[0]!);
        map.setZoom(15);
        return;
      }
      const b = new g.LatLngBounds();
      points.forEach((p) => b.extend(p));
      map.fitBounds(b, 40);
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
