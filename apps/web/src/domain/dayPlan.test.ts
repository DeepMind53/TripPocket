import type { DayPlan } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { activePlan, conditionMet, fatigueLevel, planMatches, travelKm } from './dayPlan';

const ctx = (over: Partial<Parameters<typeof conditionMet>[1]> = {}) => ({
  weather: { code: 61, min: 8, max: 14 },
  fatigue: 2,
  airBad: false,
  weekday: 6,
  holiday: false,
  ...over,
});
const plan = (id: string, conditions: DayPlan['conditions'], match: 'all' | 'any' = 'any') =>
  ({ id, date: '2026-11-12', name: id, match, conditions }) as DayPlan;

describe('Plan B 조건', () => {
  it('날씨·기온·피로도·미세먼지·요일·공휴일', () => {
    expect(conditionMet({ type: 'weather', weather: ['rain'] }, ctx())).toBe(true);
    expect(conditionMet({ type: 'weather', weather: ['clear'] }, ctx())).toBe(false);
    expect(conditionMet({ type: 'weather', weather: ['rain'] }, ctx({ weather: undefined }))).toBe(
      false,
    );
    expect(conditionMet({ type: 'tempMax', op: 'lte', value: 15 }, ctx())).toBe(true);
    expect(conditionMet({ type: 'tempMin', op: 'gte', value: 10 }, ctx())).toBe(false);
    expect(conditionMet({ type: 'fatigue', value: 4 }, ctx({ fatigue: 4 }))).toBe(true);
    expect(conditionMet({ type: 'fatigue', value: 4 }, ctx({ fatigue: null }))).toBe(false);
    expect(conditionMet({ type: 'air' }, ctx({ airBad: true }))).toBe(true);
    expect(conditionMet({ type: 'weekday', days: [0, 6] }, ctx())).toBe(true);
    expect(conditionMet({ type: 'holiday' }, ctx())).toBe(false);
  });

  it('모두 / 하나라도, 조건 없는 플랜은 자동으로 안 고른다', () => {
    const conds: DayPlan['conditions'] = [
      { type: 'weather', weather: ['rain'] },
      { type: 'fatigue', value: 4 },
    ];
    expect(planMatches(plan('a', conds, 'any'), ctx())).toBe(true);
    expect(planMatches(plan('a', conds, 'all'), ctx())).toBe(false);
    expect(planMatches(plan('a', []), ctx())).toBe(false);
  });

  it('직접 고른 것이 먼저, 그다음 조건이 맞는 첫 플랜, 없으면 기본', () => {
    const b = plan('b', [{ type: 'weather', weather: ['rain'] }]);
    const c = plan('c', [{ type: 'fatigue', value: 4 }]);
    expect(activePlan([c, b], ctx())).toEqual({ plan: b, by: 'auto' });
    expect(activePlan([c, b], ctx(), 'c')).toEqual({ plan: c, by: 'pick' });
    expect(activePlan([c, b], ctx(), 'base')).toEqual({ plan: null, by: 'pick' });
    expect(activePlan([c], ctx())).toEqual({ plan: null, by: null });
  });
});

describe('피로도: 당일 컨디션 + 전날 이동 거리', () => {
  const p = (lat: number) => ({ kind: 'place' as const, place: { coords: { lat, lng: 139.7 } } });
  // 위도 0.1도 ≈ 11km
  const far = [p(35.6), p(35.7), p(35.8)];

  it('전날 이동 거리: 다녀온(미방문 아닌) 장소 사이 직선거리', () => {
    expect(travelKm([])).toBeNull();
    expect(travelKm(far)).toBeGreaterThan(20);
    expect(travelKm([p(35.6), { ...p(35.7), visit: 'skipped' as const }])).toBe(0);
  });

  it('컨디션 2 : 이동 거리 1 · 하나만 있으면 그것으로 · 둘 다 없으면 null', () => {
    expect(fatigueLevel(1, far).level).toBe(2);
    expect(fatigueLevel(5, []).level).toBe(5);
    expect(fatigueLevel(null, far).level).toBe(5);
    expect(fatigueLevel(null, []).level).toBeNull();
  });
});
