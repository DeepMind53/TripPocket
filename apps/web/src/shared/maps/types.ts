/** 지도 제공자 공통 인터페이스 (docs/10 §3) — 화면은 구글·네이버를 몰라도 된다 */
export type MapProviderId = 'google' | 'naver';
/** 실제로 그린 지도 — osm = MapLibre + OpenFreeMap 백업 (설정에서 고르지는 않음, docs/23 §4) */
export type ActiveMapId = MapProviderId | 'osm';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id: string;
  position: LatLng;
  /** 핀 안 글자 (일정 번호) */
  label: string;
  color: string;
  title: string;
}

export interface MapHandle {
  setMarkers(markers: readonly MapMarker[]): void;
  /** 일차별 순서선 */
  drawPaths(paths: readonly { color: string; points: readonly LatLng[] }[]): void;
  fitBounds(points: readonly LatLng[]): void;
  /** 한 곳으로 부드럽게 옮기기 (지도 크게 보기에서 일정을 넘길 때) */
  panTo(point: LatLng): void;
  /** 지도 상자 크기가 바뀐 뒤 (크게·전체 화면) */
  resize(): void;
  onMarkerClick(cb: (id: string) => void): void;
  destroy(): void;
}

export interface MapOptions {
  center: LatLng;
  zoom: number;
}
