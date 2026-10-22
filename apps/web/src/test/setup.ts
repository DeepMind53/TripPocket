import '@testing-library/jest-dom/vitest';

// jsdom에 없는 브라우저 API (Radix Slider 등이 사용)
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
