import { choosePeriod, withinMonths, type PeriodMonths } from './periods';

/**
 * AI 추천 ② 점수·정리 (docs/14 §5~6) — AI가 뽑은 장소를 근거 글과 묶어 점수를 매긴다. 순수 함수
 */
export type AiCategory = 'food' | 'cafe' | 'play';

export interface SourcePost {
  id: string;
  title: string;
  link: string;
  postdate: string;
}

/** AI 출력 (검증 전) */
export interface ExtractedPlace {
  name: string;
  category: AiCategory;
  sourceIds: string[];
  adSuspect: boolean;
  summary: string;
}

export interface Recommendation {
  name: string;
  category: AiCategory;
  mentions: number;
  lastMentioned: string;
  score: number;
  adSuspect: boolean;
  summary: string;
  sources: SourcePost[];
}

export interface CategoryResult {
  months: PeriodMonths;
  /** 12개월까지 넓혀도 부족 → "정보가 적은 지역" 안내 */
  enough: boolean;
  places: Recommendation[];
}

/** 최근 언급에 가중치 (오래된 인기 장소가 최근 핫플을 덮지 않게) */
const weight = (postdate: string, now: Date) =>
  withinMonths(postdate, 1, now)
    ? 1
    : withinMonths(postdate, 3, now)
      ? 0.7
      : withinMonths(postdate, 6, now)
        ? 0.5
        : 0.3;

/**
 * AI가 준 근거 id 중 실제 수집한 글만 남기고(없는 id는 버림), 카테고리별 기간을 고른 뒤 점수순 상위 5곳
 */
export function buildRecommendations(
  extracted: readonly ExtractedPlace[],
  posts: readonly SourcePost[],
  now: Date,
  top = 5,
): Record<AiCategory, CategoryResult> {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const out = {} as Record<AiCategory, CategoryResult>;
  for (const category of ['food', 'cafe', 'play'] as const) {
    // 같은 이름은 합친다
    const merged = new Map<string, ExtractedPlace>();
    for (const e of extracted.filter((x) => x.category === category && x.name.trim())) {
      const key = e.name.replace(/\s+/g, '').toLowerCase();
      const prev = merged.get(key);
      merged.set(
        key,
        prev
          ? {
              ...prev,
              sourceIds: [...new Set([...prev.sourceIds, ...e.sourceIds])],
              adSuspect: prev.adSuspect && e.adSuspect,
            }
          : e,
      );
    }
    const withSources = [...merged.values()]
      .map((e) => ({
        e,
        sources: e.sourceIds.map((id) => byId.get(id)).filter((p): p is SourcePost => !!p),
      }))
      .filter((x) => x.sources.length > 0);
    const mentions = new Map(withSources.map((x) => [x.e.name, x.sources.map((s) => s.postdate)]));
    const { months, enough } = choosePeriod(mentions, now);
    const places = withSources
      .map(({ e, sources }) => {
        const inPeriod = sources.filter((s) => withinMonths(s.postdate, months, now));
        const score =
          inPeriod.reduce((sum, s) => sum + weight(s.postdate, now), 0) * (e.adSuspect ? 0.5 : 1);
        return {
          name: e.name.trim(),
          category,
          mentions: inPeriod.length,
          lastMentioned: [...sources].sort((a, b) => b.postdate.localeCompare(a.postdate))[0]!
            .postdate,
          score: Math.round(score * 100) / 100,
          adSuspect: e.adSuspect,
          summary: e.summary.slice(0, 80),
          sources: inPeriod.sort((a, b) => b.postdate.localeCompare(a.postdate)).slice(0, 5),
        };
      })
      .filter((r) => r.mentions > 0)
      .sort((a, b) => b.score - a.score || b.mentions - a.mentions)
      .slice(0, top);
    out[category] = { months, enough, places };
  }
  return out;
}
