import {
  addDays,
  getTripDays,
  type DayPlan,
  type ItineraryItem,
  type LocalDate,
  type Trip,
} from '@trippocket/shared';
import { dayKey, useDayPlanStore } from '../../data/dayPlanStore';
import { airWarnings } from '../../domain/air';
import { activePlan, fatigueLevel } from '../../domain/dayPlan';
import { useSettings } from '../../data/settingsStore';
import { useTripWeather, type TripDayWeather } from '../common/useTripWeather';
import { useTripHolidays } from './useTripHolidays';

export interface DayPlanInfo {
  plans: DayPlan[];
  /** 지금 보이는 플랜 (null = 기본 일정) */
  plan: DayPlan | null;
  /** pick = 직접 고름, auto = 조건이 맞음 */
  by: 'pick' | 'auto' | null;
  mood: number | undefined;
  fatigue: number | null;
  /** 전날 이동 거리 (km) */
  km: number | null;
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
  const on = useSettings((s) => s.planB);
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
    const { level, km } = fatigueLevel(mood, shown.get(addDays(date, -1)) ?? []);
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
    info[date] = { plans, plan, by, mood, fatigue: level, km };
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

/**
 * 일정 화면 밖(홈 "오늘 일정" 등)에서도 같은 플랜 기준으로 보이는 일정만 (2026-11-03 — 지도·홈이 플랜과 어긋나지 않게)
 */
export function useTripPlanItems(trip: Trip, items: ItineraryItem[]): ItineraryItem[] {
  const weather = useTripWeather(trip);
  const holidays = useTripHolidays(
    trip,
    useSettings((st) => st.localHoliday),
  );
  return usePlanView(trip, items, getTripDays(trip.startDate, trip.endDate), weather, holidays)
    .visible;
}
