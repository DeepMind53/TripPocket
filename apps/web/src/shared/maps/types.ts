/** 지도 제공자 공통 인터페이스 (docs/10 §3) — 화면은 구글·네이버를 몰라도 된다 */
export type MapProviderId = 'google' | 'naver';

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
  onMarkerClick(cb: (id: string) => void): void;
  destroy(): void;
}

export interface MapOptions {
  center: LatLng;
  zoom: number;
}
