import { choosePeriod, withinMonths, type PeriodMonths } from './periods';

/**
 * AI 추천 ② 점수·정리 (docs/14 §5~6) — AI가 뽑은 장소를 근거 글과 묶어 점수를 매긴다. 순수 함수
 */
/** custom = 사용자가 입력한 키워드 (예: 라멘, 야경) */
export type AiCategory = 'food' | 'cafe' | 'play' | 'custom';
export const AI_CATEGORIES: readonly AiCategory[] = ['food', 'cafe', 'play', 'custom'];

/** 가까운 곳부터: 5km 안에 충분하면 5km, 아니면 10km, 그래도 없으면 50km (사용자 요청 2026-10-24) */
export const RADIUS_TIERS_KM = [5, 10, 50] as const;

/**
 * 거리 단계 고르기: 가장 작은 반경에 min곳 이상이면 그 반경, 아니면 다음 반경. 마지막 반경 밖은 버린다.
 * km = 기준점까지 거리 (모르면 null — 위치를 모르는 곳은 맨 뒤에 붙인다)
 */
export function pickRadius<T>(
  list: readonly T[],
  km: (item: T) => number | null,
  min = 3,
  tiers: readonly number[] = RADIUS_TIERS_KM,
): { radiusKm: number; items: T[] } {
  const known = list.filter((x) => km(x) !== null);
  const unknown = list.filter((x) => km(x) === null);
  const last = tiers[tiers.length - 1]!;
  for (const r of tiers) {
    const inside = known.filter((x) => km(x)! <= r);
    if (inside.length >= min || r === last) {
      // 가까운 단계에 모자라면 위치 모르는 곳으로 채운다 (순서는 원래 점수순 유지)
      return { radiusKm: r, items: [...inside, ...unknown] };
    }
  }
  return { radiusKm: last, items: [...unknown] };
}

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
  for (const category of AI_CATEGORIES) {
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
