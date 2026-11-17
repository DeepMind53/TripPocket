import { describe, expect, it } from 'vitest';
import { mapViewOf, resizeMap, toggleMapBase } from './mapView';

describe('mapViewOf', () => {
  it('편집 중이거나 닫혀 있으면 닫힘 (전체 화면 기록이 남아 있어도)', () => {
    expect(mapViewOf('large', true, true)).toBe('closed');
    expect(mapViewOf('closed', true, false)).toBe('closed');
  });
  it('전체 화면이 기본 크기보다 우선', () => {
    expect(mapViewOf('small', true, false)).toBe('full');
    expect(mapViewOf('large', false, false)).toBe('large');
  });
});

describe('toggleMapBase', () => {
  it('닫힘 → 작게, 작게·크게 → 닫힘', () => {
    expect(toggleMapBase('closed')).toBe('small');
    expect(toggleMapBase('small')).toBe('closed');
    expect(toggleMapBase('large')).toBe('closed');
  });
});

describe('resizeMap', () => {
  it('전체로', () => {
    expect(resizeMap('small', 'full')).toEqual({ kind: 'openFull' });
  });
  it('전체 화면에서는 무엇을 눌러도 전체만 닫음 (이전 크기로 돌아감)', () => {
    expect(resizeMap('full', 'large')).toEqual({ kind: 'closeFull' });
    expect(resizeMap('full', 'small')).toEqual({ kind: 'closeFull' });
  });
  it('작게 ↔ 크게', () => {
    expect(resizeMap('small', 'large')).toEqual({ kind: 'setBase', base: 'large' });
    expect(resizeMap('large', 'small')).toEqual({ kind: 'setBase', base: 'small' });
  });
});
