import { create } from 'zustand';

/**
 * 타이머 (실험실 quickTimer, 2026-11-13): 끝나는 시각만 이 기기에 저장 — 앱을 다시 열어도 이어서 센다.
 * 끝나면 알림·진동은 TimerWatch가 (앱이 열려 있을 때)
 */
const KEY = 'tp-timer';

export interface TimerState {
  /** 끝나는 때 (ms), 없으면 null */
  end: number | null;
  /** 맞춘 분 */
  minutes: number;
}

function load(): TimerState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as TimerState | null;
    if (v && typeof v.end === 'number' && typeof v.minutes === 'number') return v;
  } catch {
    // 저장소를 못 쓰면 꺼진 타이머
  }
  return { end: null, minutes: 0 };
}

export const useTimer = create<TimerState>(load);

export function setTimer(minutes: number | null, now = Date.now()): void {
  const next: TimerState =
    minutes === null ? { end: null, minutes: 0 } : { end: now + minutes * 60_000, minutes };
  useTimer.setState(next);
  try {
    if (next.end === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장 못 해도 이번 실행에서는 센다
  }
}
