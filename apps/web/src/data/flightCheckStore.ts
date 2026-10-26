import { create } from 'zustand';

/** 항공편 [확인]을 누른 기록: 예약 id → 확인한 출발 날짜·시각 (이 기기) */
const KEY = 'tp-flight-ok';

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export const useFlightChecks = create<Record<string, string>>(load);

export function confirmFlight(bookingId: string, signature: string): void {
  useFlightChecks.setState({ [bookingId]: signature });
  try {
    localStorage.setItem(KEY, JSON.stringify(useFlightChecks.getState()));
  } catch {
    // 저장 못 해도 이번 실행에서는 사라진다
  }
}
