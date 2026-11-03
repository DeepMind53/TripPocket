import { create } from 'zustand';

/**
 * Plan B (실험실, 2026-11-03) — 이 기기에만 저장 (동기화·백업 대상 아님):
 * - moods: 그날 컨디션 1~5 (아침 컨디션 체크·날짜 플랜 시트에서 고침)
 * - picks: 그날 직접 고른 플랜 id ('base' = 기본 일정). 없으면 조건으로 자동
 * 키는 `${tripId}:${date}`
 */
interface DayPlanState {
  moods: Record<string, number>;
  picks: Record<string, string>;
}

const KEY = 'tp-dayplan';

function load(): DayPlanState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DayPlanState>;
    return { moods: v.moods ?? {}, picks: v.picks ?? {} };
  } catch {
    return { moods: {}, picks: {} };
  }
}

export const useDayPlanStore = create<DayPlanState>(load);

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(useDayPlanStore.getState()));
  } catch {
    // 저장 못 해도 이번 실행에서는 적용
  }
}

export const dayKey = (tripId: string, date: string) => `${tripId}:${date}`;

export function setMood(tripId: string, date: string, mood: number): void {
  useDayPlanStore.setState((s) => ({ moods: { ...s.moods, [dayKey(tripId, date)]: mood } }));
  save();
}

/** pick = 플랜 id · 'base' · null(자동으로 되돌리기) */
export function setPick(tripId: string, date: string, pick: string | null): void {
  useDayPlanStore.setState((s) => {
    const picks = { ...s.picks };
    if (pick) picks[dayKey(tripId, date)] = pick;
    else delete picks[dayKey(tripId, date)];
    return { picks };
  });
  save();
}
