import { create } from 'zustand';

/**
 * 여행 모드 (실험실, docs/25 — 2026-11-03 추천안 D1~D6): 이 기기에만 저장 (D1 기기마다).
 * - on: 여행마다 켜짐 (일정 화면을 열면 여행 모드로)
 * - asked: 출발 날 한 번 물어봤는지 (D2 묻기만, 거절하면 그 여행에서는 다시 안 물음)
 * - sun: 햇빛 모드 (대비·글씨 크게, D3)
 * - remind: 다음 일정 출발 10분 전 알림 (D3, 앱이 열려 있을 때)
 */
interface TravelModeState {
  on: Record<string, boolean>;
  asked: Record<string, boolean>;
  sun: boolean;
  remind: boolean;
  /** 낮에 햇빛 모드를 한 번 권했는지 (C4) */
  sunAsked: boolean;
}

const KEY = 'tp-travel-mode';
function load(): TravelModeState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<TravelModeState>;
    return {
      on: v.on ?? {},
      asked: v.asked ?? {},
      sun: v.sun === true,
      remind: v.remind === true,
      sunAsked: v.sunAsked === true,
    };
  } catch {
    return { on: {}, asked: {}, sun: false, remind: false, sunAsked: false };
  }
}

export const useTravelMode = create<TravelModeState>(load);

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(useTravelMode.getState()));
  } catch {
    // 저장 못 해도 이번 실행에서는 적용
  }
}

export function setTravelMode(tripId: string, on: boolean): void {
  useTravelMode.setState((s) => ({
    on: { ...s.on, [tripId]: on },
    asked: { ...s.asked, [tripId]: true },
  }));
  save();
}

/** 출발 날 제안에 [괜찮아요] */
export function declineTravelMode(tripId: string): void {
  useTravelMode.setState((s) => ({ asked: { ...s.asked, [tripId]: true } }));
  save();
}

export function setTravelPrefs(
  patch: Partial<Pick<TravelModeState, 'sun' | 'remind' | 'sunAsked'>>,
): void {
  useTravelMode.setState(patch);
  save();
}
