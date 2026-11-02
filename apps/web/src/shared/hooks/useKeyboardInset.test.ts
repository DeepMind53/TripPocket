import { act, renderHook } from '@testing-library/react';
import { useKeyboardInset } from './useKeyboardInset';

/** 키보드가 뜨면 가린 높이만큼 시트를 올린다 (사용자 요청 2026-11-02) */
function fakeViewport(height: number) {
  const listeners = new Set<() => void>();
  const vv = {
    height,
    offsetTop: 0,
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  };
  vi.stubGlobal('visualViewport', vv);
  return {
    set(h: number) {
      vv.height = h;
      act(() => listeners.forEach((f) => f()));
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

it('키보드가 화면 아래를 가리면 그 높이만큼, 내려가면 0', () => {
  const vv = fakeViewport(window.innerHeight);
  const { result } = renderHook(() => useKeyboardInset(true));
  expect(result.current.inset).toBe(0);
  vv.set(window.innerHeight - 300);
  expect(result.current).toEqual({ inset: 300, height: window.innerHeight - 300 });
  vv.set(window.innerHeight);
  expect(result.current.inset).toBe(0);
});

it('주소창 정도로 조금 줄어든 것은 키보드로 보지 않고, 닫힌 시트는 듣지 않는다', () => {
  const vv = fakeViewport(window.innerHeight);
  const open = renderHook(() => useKeyboardInset(true));
  vv.set(window.innerHeight - 50);
  expect(open.result.current.inset).toBe(0);
  const closed = renderHook(() => useKeyboardInset(false));
  vv.set(window.innerHeight - 300);
  expect(closed.result.current.inset).toBe(0);
});
