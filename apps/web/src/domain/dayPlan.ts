import type { DayPlan, ItineraryItem, PlanCondition } from '@trippocket/shared';
import { dayRecap } from './dayExtras';
import { lateNightAt } from './travelExtras';
import { weatherLook, type DayWeather } from './weather';

/**
 * Plan B (실험실, 사용자 요청 2026-11-03) — 순수 함수.
 * 날짜마다 대안 플랜의 조건(날씨·기온·피로도·미세먼지·요일·공휴일)을 보고 그날 먼저 보일 플랜을 고른다.
 * 직접 고른 플랜이 조건보다 먼저. 조건을 판단할 값이 없으면(예보 없음 등) 그 조건은 안 맞은 것으로 본다
 */

/** 피로도 1~5 (1 아주 좋음 · 5 녹초) — 컨디션 체크 이모지와 같은 순서 */
export const MOODS = ['😆', '🙂', '😐', '😩', '🥵'] as const;

export interface PlanContext {
  weather?: DayWeather | undefined;
  /** 1~5 */
  fatigue?: number | null | undefined;
  airBad?: boolean | undefined;
  /** 0(일)~6(토) */
  weekday: number;
  holiday: boolean;
}

const WEATHER_OF: Record<string, string> = {
  sun: 'clear',
  partly: 'clear',
  cloud: 'cloudy',
  fog: 'cloudy',
  drizzle: 'rain',
  rain: 'rain',
  snow: 'snow',
  storm: 'storm',
};

const cmp = (op: PlanCondition['op'], a: number, b: number) => (op === 'lte' ? a <= b : a >= b);

export function conditionMet(c: PlanCondition, ctx: PlanContext): boolean {
  switch (c.type) {
    case 'weather': {
      const kind = ctx.weather ? WEATHER_OF[weatherLook(ctx.weather.code).kind] : undefined;
      return !!kind && !!c.weather?.includes(kind as never);
    }
    case 'tempMax':
      return ctx.weather?.max != null && c.value != null && cmp(c.op, ctx.weather.max, c.value);
    case 'tempMin':
      return ctx.weather?.min != null && c.value != null && cmp(c.op, ctx.weather.min, c.value);
    case 'fatigue':
      return ctx.fatigue != null && c.value != null && ctx.fatigue >= c.value;
    case 'air':
      return ctx.airBad === true;
    case 'weekday':
      return !!c.days?.includes(ctx.weekday);
    case 'holiday':
      return ctx.holiday;
  }
}

export const planMatches = (p: DayPlan, ctx: PlanContext): boolean =>
  p.conditions.length > 0 &&
  (p.match === 'all'
    ? p.conditions.every((c) => conditionMet(c, ctx))
    : p.conditions.some((c) => conditionMet(c, ctx)));

/**
 * 그날 보일 플랜: pick = 직접 고른 것('base' = 기본 일정), 없으면 조건이 맞는 첫 플랜, 없으면 기본(null)
 */
export function activePlan(
  plans: readonly DayPlan[],
  ctx: PlanContext,
  pick?: string | undefined,
): { plan: DayPlan | null; by: 'pick' | 'auto' | null } {
  if (pick === 'base') return { plan: null, by: 'pick' };
  const picked = pick ? plans.find((p) => p.id === pick) : undefined;
  if (picked) return { plan: picked, by: 'pick' };
  const auto = plans.find((p) => planMatches(p, ctx));
  return auto ? { plan: auto, by: 'auto' } : { plan: null, by: null };
}

/** 어제 일정으로 걸음 수 추정 (웹앱은 휴대폰 걸음 센서를 못 읽는다): 기본 4천 보 + 장소 사이 거리 × 1,700보/km */
export function estimateSteps(
  items: readonly Pick<ItineraryItem, 'kind' | 'place' | 'visit' | 'done' | 'transport'>[],
): number {
  // 미방문만 빼고 다녀온 것으로 본다 (방문 표시를 안 한 사람이 많아서)
  const went = items
    .filter((i) => i.visit !== 'skipped')
    .map((i) => ({ ...i, visit: 'visited' as const }));
  const { visited, km } = dayRecap(went);
  if (visited === 0) return 0;
  return Math.round((4000 + km * 1700) / 100) * 100;
}

const stepsLevel = (steps: number) =>
  steps < 6000 ? 1 : steps < 10000 ? 2 : steps < 15000 ? 3 : steps < 20000 ? 4 : 5;

/**
 * 피로도 1~5: 컨디션(이모지)이 있으면 컨디션 2 : 어제 걸음 1, 없으면 어제 걸음(+늦은 귀가 1).
 * 어제 기록도 컨디션도 없으면 null (피로도 조건은 안 맞음)
 */
export function fatigueLevel(
  mood: number | null | undefined,
  yesterday: readonly Pick<
    ItineraryItem,
    'kind' | 'place' | 'visit' | 'done' | 'transport' | 'startTime' | 'endTime'
  >[],
): { level: number | null; steps: number } {
  const steps = estimateSteps(yesterday);
  const late = lateNightAt(yesterday) ? 1 : 0;
  if (mood != null) {
    const base = steps > 0 ? (mood * 2 + Math.min(5, stepsLevel(steps) + late)) / 3 : mood;
    return { level: Math.min(5, Math.max(1, Math.round(base))), steps };
  }
  if (steps === 0) return { level: null, steps };
  return { level: Math.min(5, stepsLevel(steps) + late), steps };
}
