/**
 * 관리자 월간 갱신 안내를 띄울 날 (사용자 요청 2026-10-27: 한 달에 한 번, 무작위 날짜).
 * 달·관리자 id로 정해지는 "무작위" 날 — 같은 달에는 늘 같은 날이라 기기·새로고침마다 바뀌지 않는다.
 * 1~28일 중 (2월에도 있게)
 */
export function noticeDay(month: string, seed: string): number {
  let h = 2166136261;
  for (const ch of `${month}:${seed}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 28) + 1;
}

/** 오늘(YYYY-MM-DD) 띄울지: 이번 달 그날이 지났고, 이번 달에 아직 안 띄웠으면 */
export function shouldShowNotice(
  today: string,
  lastShownMonth: string | null,
  seed: string,
): boolean {
  const month = today.slice(0, 7);
  if (lastShownMonth === month) return false;
  return Number(today.slice(8, 10)) >= noticeDay(month, seed);
}
