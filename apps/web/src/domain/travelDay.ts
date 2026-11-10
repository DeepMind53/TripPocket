import type { ItineraryItem } from '@trippocket/shared';
import { LEAVE_MARGIN_MIN } from './dayTools';
import { weatherLook, type DayWeather } from './weather';

/**
 * 여행 모드 하루 흐름 (docs/27, 2026-11-04 결정 Q1~Q5): 시각에 따라 맨 위 카드가 바뀐다.
 * - morning: 첫 일정 시작 전
 * - day: 진행 중이거나 남은 일정이 있음
 * - evening: 시각이 있는 일정이 모두 끝남 (내일 미리보기)
 * 시각이 있는 일정이 없으면 day
 */
export type DayPhase = 'morning' | 'day' | 'evening';

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => {
  const c = Math.max(0, m);
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
};

type Timed = Pick<ItineraryItem, 'startTime' | 'endTime' | 'kind'>;

/** 일정이 끝나는 분 (끝 시각이 없으면 시작 + 1시간) */
const endOf = (i: Timed) =>
  i.endTime && i.endTime >= i.startTime! ? mins(i.endTime) : mins(i.startTime!) + 60;

export function dayPhase(items: readonly Timed[], now: string): DayPhase {
  const timed = items.filter((i) => i.kind !== 'note' && i.startTime);
  if (!timed.length) return 'day';
  const t = mins(now);
  if (timed.every((i) => mins(i.startTime!) > t)) return 'morning';
  if (timed.every((i) => endOf(i) <= t)) return 'evening';
  return 'day';
}

/**
 * 나갈 시각 (Q2): 시작 − 이동 시간 − 여유 10분. 이동 시간을 모르면 여유만 뺀다.
 * 남은 분 = 나갈 시각까지 (음수면 이미 지남)
 */
export function leaveAt(
  start: string,
  now: string,
  travelMin: number | undefined,
): { at: string; inMin: number } {
  const at = mins(start) - (travelMin ?? 0) - LEAVE_MARGIN_MIN;
  return { at: hhmm(at), inMin: at - mins(now) };
}

/** 나갈 때까지 남은 초 (지금 = 현지 하루의 몇 번째 초). 음수면 이미 지남 — 큰 "88분 38초 후 출발" */
export function leaveInSeconds(
  start: string,
  nowSec: number,
  travelMin: number | undefined,
): number {
  return (mins(start) - (travelMin ?? 0) - LEAVE_MARGIN_MIN) * 60 - nowSec;
}

export type LegMode = 'walk' | 'transit';

/**
 * 다음 일정까지 고를 수 있는 이동 (사용자 요청 2026-11-10): 길 조회 결과가 있으면 그 값, 도보가 없거나
 * 조회가 실패하면 직선거리 어림(straight = true). 대중교통은 조회로만
 */
export function legOptions(
  eta: { walk?: number | undefined; transit?: number | undefined } | null,
  straightWalkMin: number | undefined,
): { walk?: { min: number; straight: boolean }; transit?: number } {
  const walk =
    eta?.walk !== undefined
      ? { min: eta.walk, straight: false }
      : straightWalkMin !== undefined
        ? { min: straightWalkMin, straight: true }
        : undefined;
  return {
    ...(walk ? { walk } : {}),
    ...(eta?.transit !== undefined ? { transit: eta.transit } : {}),
  };
}

/** 고른 수단이 없으면 대중교통 → 도보 순 (대중교통 조회가 실패하면 저절로 도보) */
export function pickLegMode(
  opts: { walk?: unknown; transit?: unknown },
  chosen: LegMode | null,
): LegMode | null {
  if (chosen && opts[chosen] !== undefined) return chosen;
  if (opts.transit !== undefined) return 'transit';
  return opts.walk !== undefined ? 'walk' : null;
}

/** 오늘 주의 한 줄용: 지금 시각 뒤로 처음 비·눈·뇌우가 오는 시 (시간별 예보가 없으면 하루 예보로 -1) */
export function rainFrom(w: DayWeather | undefined, now: string): number | null {
  if (!w) return null;
  const wet = (code: number) => {
    const k = weatherLook(code).kind;
    return k === 'rain' || k === 'drizzle' || k === 'storm' || k === 'snow';
  };
  if (!w.hours) return wet(w.code) ? -1 : null;
  for (let h = Number(now.slice(0, 2)); h < 24; h++) {
    const c = w.hours.code[h];
    if (c !== undefined && wet(c)) return h;
  }
  return null;
}
