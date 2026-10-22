/** 여행지 기준 달력 날짜 "YYYY-MM-DD" (타임존 없음). docs/04-data-model.md §1 */
export type LocalDate = string;

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * LocalDate를 UTC 자정 기준 일수(epoch day)로 바꾼다.
 * `new Date("YYYY-MM-DD")`는 환경에 따라 하루가 밀릴 수 있어 직접 파싱한다.
 */
export function toEpochDay(date: LocalDate): number {
  const m = LOCAL_DATE_RE.exec(date);
  if (!m) throw new Error(`올바르지 않은 날짜 형식: ${date}`);
  const [, y, mo, d] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const check = new Date(ms);
  if (check.getUTCMonth() !== Number(mo) - 1 || check.getUTCDate() !== Number(d)) {
    throw new Error(`존재하지 않는 날짜: ${date}`);
  }
  return ms / 86_400_000;
}
