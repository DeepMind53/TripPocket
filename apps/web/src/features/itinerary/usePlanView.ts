import {
  addDays,
  type DayPlan,
  type ItineraryItem,
  type LocalDate,
  type Trip,
} from '@trippocket/shared';
import { dayKey, useDayPlanStore } from '../../data/dayPlanStore';
import { useLab } from '../../data/labsStore';
import { airWarnings } from '../../domain/air';
import { activePlan, fatigueLevel } from '../../domain/dayPlan';
import type { TripDayWeather } from '../common/useTripWeather';

export interface DayPlanInfo {
  plans: DayPlan[];
  /** 지금 보이는 플랜 (null = 기본 일정) */
  plan: DayPlan | null;
  /** pick = 직접 고름, auto = 조건이 맞음 */
  by: 'pick' | 'auto' | null;
  mood: number | undefined;
  fatigue: number | null;
  steps: number;
}

/**
 * Plan B (실험실, 2026-11-03): 날짜마다 보일 플랜을 골라 그 플랜 일정만 남긴다.
 * 꺼져 있으면 대안 플랜 일정(planId)은 숨기고 기본 일정만. 플랜이 지워진 일정은 기본으로 본다.
 * 피로도는 전날 "보이는" 일정으로 계산하므로 날짜 순서대로 정한다
 */
export function usePlanView(
  trip: Trip,
  items: ItineraryItem[],
  days: readonly LocalDate[],
  weather: Record<LocalDate, TripDayWeather>,
  holidays: Record<LocalDate, string>,
): { visible: ItineraryItem[]; info: Record<LocalDate, DayPlanInfo>; on: boolean } {
  const on = useLab('planB');
  const { moods, picks } = useDayPlanStore();
  const known = new Set((trip.dayPlans ?? []).map((p) => p.id));
  const planOf = (i: ItineraryItem) => (i.planId && known.has(i.planId) ? i.planId : null);
  if (!on) return { visible: items.filter((i) => !i.planId), info: {}, on };
  const info: Record<LocalDate, DayPlanInfo> = {};
  const shown = new Map<LocalDate, ItineraryItem[]>();
  for (const date of days) {
    const plans = (trip.dayPlans ?? []).filter((p) => p.date === date);
    const key = dayKey(trip.id, date);
    const mood = moods[key];
    const { level, steps } = fatigueLevel(mood, shown.get(addDays(date, -1)) ?? []);
    const w = weather[date];
    const { plan, by } = activePlan(
      plans,
      {
        weather: w && !w.year ? w : undefined,
        fatigue: level,
        airBad: airWarnings(w?.air).some((x) => x.key.startsWith('pm25')),
        weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
        holiday: !!holidays[date],
      },
      picks[key],
    );
    info[date] = { plans, plan, by, mood, fatigue: level, steps };
    shown.set(
      date,
      items.filter((i) => i.date === date && planOf(i) === (plan?.id ?? null)),
    );
  }
  const visible = items.filter(
    (i) => i.date === null || !days.includes(i.date) || shown.get(i.date)?.includes(i),
  );
  return { visible, info, on };
}
