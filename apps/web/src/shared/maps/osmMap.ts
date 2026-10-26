import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { pinSvg } from './loadScript';
import type { LatLng, MapHandle, MapMarker, MapOptions } from './types';

/** OpenFreeMap 무료 벡터 지도 (키·한도 없음, 기부 운영) — "© OpenMapTiles © OpenStreetMap" 표기는 지도 오른쪽 아래 */
export const OSM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * MapLibre + OpenFreeMap (docs/23 §4, 사용자 결정 2026-10-26): Google·네이버 지도를 못 쓸 때 마지막 백업.
 * 지도 화면에서만 불러온다 (첫 화면 크기에 영향 없음)
 */
export async function mountOsm(el: HTMLElement, opts: MapOptions): Promise<MapHandle> {
  maplibregl.setWorkerUrl(workerUrl);
  const map = new maplibregl.Map({
    container: el,
    style: OSM_STYLE,
    center: [opts.center.lng, opts.center.lat],
    zoom: opts.zoom,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  await new Promise<void>((resolve, reject) => {
    map.once('load', () => resolve());
    map.once('error', () => reject(new Error('osm map failed')));
  });
  map.addSource('paths', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'paths',
    type: 'line',
    source: 'paths',
    paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.8 },
  });
  const ll = (p: LatLng): [number, number] => [p.lng, p.lat];
  let markers: maplibregl.Marker[] = [];
  let onClick: (id: string) => void = () => {};

  return {
    setMarkers(list: readonly MapMarker[]) {
      markers.forEach((m) => m.remove());
      markers = list.map((m) => {
        const img = document.createElement('img');
        img.src = pinSvg(m.label, m.color);
        img.width = 30;
        img.height = 30;
        img.alt = m.title;
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => onClick(m.id));
        return new maplibregl.Marker({ element: img }).setLngLat(ll(m.position)).addTo(map);
      });
    },
    drawPaths(paths) {
      const src = map.getSource<maplibregl.GeoJSONSource>('paths');
      src?.setData({
        type: 'FeatureCollection',
        features: paths
          .filter((p) => p.points.length > 1)
          .map((p) => ({
            type: 'Feature' as const,
            properties: { color: p.color },
            geometry: { type: 'LineString' as const, coordinates: p.points.map(ll) },
          })),
      });
    },
    fitBounds(points) {
      if (points.length === 0) return;
      if (points.length === 1) {
        map.jumpTo({ center: ll(points[0]!), zoom: 15 });
        return;
      }
      const b = new maplibregl.LngLatBounds(ll(points[0]!), ll(points[0]!));
      points.forEach((p) => b.extend(ll(p)));
      map.fitBounds(b, { padding: 40, animate: false });
    },
    panTo(p) {
      map.panTo(ll(p));
    },
    resize() {
      map.resize();
    },
    onMarkerClick(cb) {
      onClick = cb;
    },
    destroy() {
      markers.forEach((m) => m.remove());
      map.remove();
    },
  };
}
