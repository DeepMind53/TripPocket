/**
 * 일정 화면 지도 상태 (2026-11-17 상태 머신 정리 — 전에는 mapOpen·mapLarge·mapFull 세 참/거짓 값 + 편집 중).
 * - 기본 크기(base): 닫힘 / 작게 / 크게 — 화면 상태
 * - 전체 화면(full): 뒤로 가기로 닫히도록 브라우저 기록(시트)에 — 닫으면 기본 크기로 돌아간다
 * - 편집 중에는 지도를 그리지 않는다
 */
export type MapBase = 'closed' | 'small' | 'large';
export type MapView = MapBase | 'full';

/** 지금 보이는 지도 */
export function mapViewOf(base: MapBase, full: boolean, editing: boolean): MapView {
  if (editing || base === 'closed') return 'closed';
  return full ? 'full' : base;
}

/** [지도] 칩: 닫혀 있으면 작게 열고, 열려 있으면 닫는다 (크게 보던 것도 닫힘) */
export function toggleMapBase(base: MapBase): MapBase {
  return base === 'closed' ? 'small' : 'closed';
}

/**
 * 지도 안 크기 버튼(작게·크게·전체)을 눌렀을 때 할 일.
 * 전체 화면이면 무엇을 눌러도 전체 화면만 닫고(뒤로 가기) 기본 크기는 그대로
 */
export function resizeMap(
  view: MapView,
  next: 'small' | 'large' | 'full',
): { kind: 'openFull' } | { kind: 'closeFull' } | { kind: 'setBase'; base: MapBase } {
  if (next === 'full') return { kind: 'openFull' };
  if (view === 'full') return { kind: 'closeFull' };
  return { kind: 'setBase', base: next };
}
