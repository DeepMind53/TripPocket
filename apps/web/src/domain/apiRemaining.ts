/** 관리자 API 사용량: 무료량 중 남은 비율 (0~1). 월·하루 한도 중 더 적게 남은 쪽, 한도가 없으면 null */
export function remainingRatio(a: {
  freeMonthly: number | null;
  freeDaily: number | null;
  used: number;
  today: number;
}): number | null {
  const left = [
    a.freeMonthly ? 1 - a.used / a.freeMonthly : null,
    a.freeDaily ? 1 - a.today / a.freeDaily : null,
  ].filter((x): x is number => x !== null);
  return left.length ? Math.max(0, Math.min(...left)) : null;
}

/** 남은 비율에 따른 바탕 (사용자 요청 2026-10-27): 5% 미만 옅은 빨강, 20% 미만 옅은 주황 */
export function remainingTone(ratio: number | null): 'danger' | 'warning' | null {
  if (ratio === null) return null;
  if (ratio < 0.05) return 'danger';
  if (ratio < 0.2) return 'warning';
  return null;
}
