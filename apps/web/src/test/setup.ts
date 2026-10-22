import { configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import '../i18n';
import 'fake-indexeddb/auto';

// jsdom에 없는 브라우저 API (Radix Slider 등이 사용)
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// 다른 패키지 테스트와 동시에 돌아 CPU가 바쁠 때 화면 갱신을 기다리는 시간 (기본 1초 → 5초).
// 이게 짧으면 '가끔 실패하는 테스트'가 생긴다 (2026-10-22 원인 확인)
configure({ asyncUtilTimeout: 5000 });
