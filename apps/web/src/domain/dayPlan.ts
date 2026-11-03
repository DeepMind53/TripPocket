import type { DayPlan, ItineraryItem, PlanCondition } from '@trippocket/shared';
import { dayRecap } from './dayExtras';
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

/**
 * 전날 이동 거리 (km, 장소 사이 직선거리 합) — 미방문만 빼고 다녀온 것으로 본다 (방문 표시를 안 한 사람이 많아서).
 * 다녀온 장소가 없으면 null
 */
export function travelKm(
  items: readonly Pick<ItineraryItem, 'kind' | 'place' | 'visit' | 'done' | 'transport'>[],
): number | null {
  const went = items
    .filter((i) => i.visit !== 'skipped')
    .map((i) => ({ ...i, visit: 'visited' as const }));
  const { visited, km } = dayRecap(went);
  return visited === 0 ? null : km;
}

/** 이동 거리 → 피로 1~5 (도시 여행 기준: 3·6·10·15km) */
const kmLevel = (km: number) => (km < 3 ? 1 : km < 6 ? 2 : km < 10 ? 3 : km < 15 ? 4 : 5);

/**
 * 피로도 1~5 (사용자 요청 2026-11-03): 당일 고른 컨디션과 전날 이동 거리로 판단 — 컨디션 2 : 이동 거리 1.
 * 둘 중 하나만 있으면 그것으로, 둘 다 없으면 null (피로도 조건은 안 맞음)
 */
export function fatigueLevel(
  mood: number | null | undefined,
  yesterday: readonly Pick<ItineraryItem, 'kind' | 'place' | 'visit' | 'done' | 'transport'>[],
): { level: number | null; km: number | null } {
  const km = travelKm(yesterday);
  if (mood != null) {
    const base = km != null ? (mood * 2 + kmLevel(km)) / 3 : mood;
    return { level: Math.min(5, Math.max(1, Math.round(base))), km };
  }
  return { level: km != null ? kmLevel(km) : null, km };
}
