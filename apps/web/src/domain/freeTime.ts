/**
 * 일정 사이 빈 시간 (실험실 freeTime, 2026-11-13): 앞 일정 끝 시각 → 다음 일정 시작 시각이 90분 이상 비면 그 분.
 * 끝 시각이 없는 일정은 언제 끝나는지 모르니 세지 않는다. 자정을 넘는 일정(다음 날 새벽)도 세지 않는다
 */
export const FREE_TIME_MIN = 90;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

export function freeGapMin(
  from: { endTime?: string | undefined },
  to: { startTime?: string | undefined } | undefined,
): number | null {
  if (!from.endTime || !to?.startTime) return null;
  const gap = toMin(to.startTime) - toMin(from.endTime);
  return gap >= FREE_TIME_MIN ? gap : null;
}

/** 150 → { h: 2, m: 30 } */
export const splitHM = (min: number) => ({ h: Math.floor(min / 60), m: min % 60 });
