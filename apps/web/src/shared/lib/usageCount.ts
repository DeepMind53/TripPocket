/**
 * 기능 사용 횟수 세기 (ADR-0009) — 기기에만 모아 두고 data/usageStats.ts가 동기화 뒤에 보낸다.
 * 이름은 정해진 영문 이름뿐: 입력 내용·장소·위치·id는 넣지 않는다
 */
const KEY = 'tp-usage';
export type Counts = Record<string, Record<string, number>>;

/** 한국 날짜 — 서버 통계와 같은 기준 */
export const usageToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

export function loadUsage(): Counts {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Counts;
  } catch {
    return {};
  }
}
export function saveUsage(c: Counts): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // 저장 못 하면 이번 횟수는 버린다
  }
}

/** 화면 경로 → 통계 이름 ("/trips/0192…/day" → "screen:/trips/:id/day") */
export function screenName(pathname: string): string {
  const path = pathname
    .split('/')
    .map((s) => (/^[0-9a-f-]{16,}$/i.test(s) || /^\d+$/.test(s) ? ':id' : s))
    .join('/');
  return `screen:${path === '' ? '/' : path}`.slice(0, 60);
}

export function countUse(name: string, n = 1): void {
  if (!/^[a-z][a-zA-Z0-9_.:/-]{0,59}$/.test(name)) return;
  const c = loadUsage();
  const d = (c[usageToday()] ??= {});
  d[name] = (d[name] ?? 0) + n;
  saveUsage(c);
}
