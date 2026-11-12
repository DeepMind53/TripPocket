import { act, renderHook } from '@testing-library/react';
import { timeIn, useMinuteClock } from './useMinuteClock';

afterEach(() => vi.useRealTimers());

it('현지 시각: 연 시점이 아니라 실제 분이 바뀔 때, 앱으로 돌아올 때 바로 맞춘다 (2026-11-13)', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-13T01:00:40Z')); // 도쿄 10:00:40
  const { result } = renderHook(() => useMinuteClock(true));
  const shown = () => timeIn('Asia/Tokyo', result.current);
  expect(shown()).toBe('10:00');
  // 20초 뒤 분이 바뀌면 바로 (예전에는 연 시점부터 60초 뒤)
  act(() => vi.advanceTimersByTime(20_100));
  expect(shown()).toBe('10:01');
  // 화면이 꺼져 타이머가 멈췄다가 5분 뒤 돌아오면 바로
  vi.setSystemTime(new Date('2026-11-13T01:06:10Z'));
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(shown()).toBe('10:06');
});
