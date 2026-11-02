import { create } from 'zustand';
import type { AirportReport } from './api/flights';

/**
 * 항공 예약별로 마지막에 확인한 공항 정보 (터미널·체크인 카운터·게이트) — 이 기기에만.
 * 바뀔 수 있는 값이라 확인 시각과 함께 남기고 화면에서 "출발 전날 다시 확인"을 안내한다 (사용자 요청 2026-11-02)
 */
const KEY = 'tp-flight-airport';
type Saved = Record<string, AirportReport & { flightNo: string; date: string }>;

function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved;
  } catch {
    return {};
  }
}

export const useFlightAirport = create<Saved>(load);

export function saveFlightAirport(
  bookingId: string,
  value: AirportReport & { flightNo: string; date: string },
): void {
  useFlightAirport.setState({ [bookingId]: value });
  try {
    // 오래된 예약 기록은 30개까지만
    const all = Object.entries(useFlightAirport.getState()).slice(-30);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(all)));
  } catch {
    // 저장 못 해도 이번 실행에서는 보인다
  }
}
