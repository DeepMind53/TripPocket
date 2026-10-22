/**
 * AI 추천 기간 단계 확장 (docs/14 §4): 1 → 3 → 6 → 12개월.
 * 카테고리마다 따로: "언급 2회 이상인 장소가 5곳 미만"이면 다음 기간으로.
 * 장소 추출(누가 몇 번 언급됐나)은 21단계 — 여기서는 추출 결과(장소별 언급 날짜)를 받아 판단만 한다
 */
export const PERIOD_MONTHS = [1, 3, 6, 12] as const;
export type PeriodMonths = (typeof PERIOD_MONTHS)[number];

export interface PeriodRule {
  minMentions: number;
  minPlaces: number;
}
export const DEFAULT_RULE: PeriodRule = { minMentions: 2, minPlaces: 5 };

/** YYYYMMDD 또는 YYYY-MM-DD → 오늘 기준 몇 달 안인가 */
export function withinMonths(postdate: string, months: number, now: Date): boolean {
  const d = postdate.replace(/-/g, '');
  if (!/^\d{8}$/.test(d)) return false;
  const since = new Date(now);
  since.setMonth(since.getMonth() - months);
  const ymd = since.toISOString().slice(0, 10).replace(/-/g, '');
  return d >= ymd;
}

/** 기간별 글 수 (개발 화면·로그용) */
export function countByPeriod(
  postdates: readonly string[],
  now: Date,
): Record<PeriodMonths, number> {
  const out = {} as Record<PeriodMonths, number>;
  for (const m of PERIOD_MONTHS) out[m] = postdates.filter((d) => withinMonths(d, m, now)).length;
  return out;
}

/**
 * 장소별 언급 날짜 → 쓸 기간. 12개월까지 넓혀도 부족하면 12 (있는 만큼 보여 주고 "정보가 적은 지역" 안내)
 */
export function choosePeriod(
  mentions: ReadonlyMap<string, readonly string[]>,
  now: Date,
  rule: PeriodRule = DEFAULT_RULE,
): { months: PeriodMonths; enough: boolean } {
  for (const months of PERIOD_MONTHS) {
    let places = 0;
    for (const dates of mentions.values())
      if (dates.filter((d) => withinMonths(d, months, now)).length >= rule.minMentions) places++;
    if (places >= rule.minPlaces) return { months, enough: true };
  }
  return { months: 12, enough: false };
}
