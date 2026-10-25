import {
  buildRecommendations,
  countByPeriod,
  distanceKm,
  cleanShortText,
  pickRadius,
  type AiCategory,
  type CategoryResult,
  type PlaceSummary,
  type Recommendation,
} from '@trippocket/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as z from 'zod/mini';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { requireAdmin } from './admin';
import { resolveAnchor } from '../services/anchor';
import { basicExtract, namesOf, norm, WORD } from '../services/basicRecommend';
import { extractPlaces, llmProviders, type LlmEngine } from '../services/llm';
import { naverSearchKeys, searchBlog, type BlogPost } from '../services/naverBlog';
import { searchGoogle, searchKakao } from '../services/places';
import { apiAllowed } from '../services/apiUsage';

/** 카테고리별 블로그 검색어 (docs/14 §3-4). custom = 사용자 키워드 그대로 */
const QUERIES: Record<Exclude<AiCategory, 'custom'>, readonly string[]> = {
  food: ['맛집'],
  cafe: ['카페', '핫플'],
  play: ['가볼만한곳', '놀거리'],
};
const queriesFor = (c: AiCategory, keyword?: string) =>
  c === 'custom' ? (keyword ? [keyword] : []) : QUERIES[c];
const mapWord = (c: AiCategory, keyword?: string) => (c === 'custom' ? (keyword ?? '') : WORD[c]);

const Body = z.object({
  anchor: z.union([
    z.object({
      type: z.literal('coords'),
      lat: z.number().check(z.gte(-90), z.lte(90)),
      lng: z.number().check(z.gte(-180), z.lte(180)),
    }),
    z.object({ type: z.literal('text'), name: z.string().check(z.minLength(1), z.maxLength(40)) }),
    z.object({
      type: z.literal('lodging'),
      name: z.string().check(z.minLength(1), z.maxLength(60)),
    }),
    // 지역 입력 드롭다운에서 고른 장소 (이름 + 그 장소 좌표 — 사용자 위치 아님)
    z.object({
      type: z.literal('place'),
      name: z.string().check(z.minLength(1), z.maxLength(60)),
      lat: z.number().check(z.gte(-90), z.lte(90)),
      lng: z.number().check(z.gte(-180), z.lte(180)),
    }),
  ]),
  categories: z.array(z.enum(['food', 'cafe', 'play'])).check(z.maxLength(3)),
  /** 직접 입력한 키워드 (예: 라멘, 야경) → custom 카테고리 */
  keyword: z.optional(z.string().check(z.maxLength(40))),
  /** 국내 여행이면 결과 장소를 카카오로 확인(좌표, 무료) */
  domestic: z._default(z.boolean(), false),
});

const DAILY_LIMIT = 20;
const CACHE_HOURS = 6;
/** 점수 계산에 쓰는 글 수 (카테고리마다, 최신순). AI에는 이 중 각 AI가 받을 수 있는 만큼만 (llm.ts) */
const AI_POSTS = 200;
/** 보여 줄 장소 수, 거르기 전 후보 수. 거리는 기준점에서 5 → 10 → 50km (shared pickRadius) */
const TOP = 5;
const CANDIDATES = 15;
/** 이만큼 모이면 더 먼 단계로 넓히지 않는다 */
const ENOUGH = 3;

export interface RecommendResult {
  anchor: string;
  createdAt: string;
  categories: Partial<
    Record<
      AiCategory,
      CategoryResult & {
        places: Rec[];
        /** 어느 AI가 정리했는지. basic = 모든 무료 AI가 한도 → AI 없이 언급 수로 집계 */
        engine: LlmEngine | 'basic';
        /** 이 반경(km) 안에서 골랐다. 기준점 위치를 모르면 없음 */
        radiusKm?: number;
      }
    >
  >;
  /** custom 카테고리의 키워드 */
  keyword?: string;
}

/** 어디서 찾았나: blog = 네이버 블로그(AI 정리), google = Google 장소 검색, both = 둘 다 */
type Origin = 'blog' | 'google' | 'both';
type Rec = Recommendation & { place?: PlaceSummary; origin: Origin };

/**
 * AI 추천 (docs/14): ① 수집(20단계, 개발 화면) ② Groq 정리 + 점수(21단계).
 * 로그인 필요, 하루 20회, 같은 기준점·카테고리 6시간 캐시. 좌표는 본문으로만 받고 역 이름으로 바꾼 뒤 버린다
 */
export function aiRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const naver = naverSearchKeys(config);
  const providers = llmProviders(config);
  const today = () => new Date().toISOString().slice(0, 10);
  const usedToday = (userId: string) =>
    (
      db
        .prepare('SELECT count FROM ai_usage WHERE user_id = ? AND date = ?')
        .get(userId, today()) as { count: number } | undefined
    )?.count ?? 0;
  const getCache = (key: string) =>
    (
      db
        .prepare('SELECT result_json FROM ai_cache WHERE key = ? AND expires_at > ?')
        .get(key, new Date().toISOString()) as { result_json: string } | undefined
    )?.result_json;
  const putCache = (key: string, value: unknown) => {
    const now = Date.now();
    db.prepare('DELETE FROM ai_cache WHERE expires_at < ?').run(new Date(now).toISOString());
    db.prepare(
      'INSERT OR REPLACE INTO ai_cache (key, result_json, expires_at) VALUES (?, ?, ?)',
    ).run(key, JSON.stringify(value), new Date(now + CACHE_HOURS * 3_600_000).toISOString());
  };
  const countUse = (userId: string) =>
    db
      .prepare(
        `INSERT INTO ai_usage (user_id, date, count) VALUES (?, ?, 1)
         ON CONFLICT (user_id, date) DO UPDATE SET count = count + 1`,
      )
      .run(userId, today());

  /** 공통: 요청 확인 → 한도 → 기준점 이름. 문제가 있으면 응답을 보내고 null */
  async function prepare(req: FastifyRequest, reply: FastifyReply) {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return (void reply.code(400).send({ error: 'bad_request' }), null);
    if (!naver) return (void reply.code(503).send({ error: 'not_configured' }), null);
    // 키워드는 닉네임과 같은 규칙으로 다듬는다 (제어 문자 제거, 1~20자)
    const rawKeyword = parsed.data.keyword?.trim();
    const keyword = rawKeyword ? cleanShortText(rawKeyword, 20) : null;
    if (rawKeyword && !keyword) return (void reply.code(400).send({ error: 'bad_request' }), null);
    const categories = [
      ...[...new Set(parsed.data.categories)].sort(),
      ...(keyword ? ['custom'] : []),
    ] as AiCategory[];
    if (categories.length === 0) return (void reply.code(400).send({ error: 'bad_request' }), null);
    if (usedToday(req.user!.userId) >= DAILY_LIMIT)
      return (
        void reply.code(429).send({ error: 'daily_limit', feature: 'ai', limit: DAILY_LIMIT }),
        null
      );
    const a = parsed.data.anchor;
    const anchor =
      a.type === 'place'
        ? a.name.trim().slice(0, 40)
        : await resolveAnchor(a, config.KAKAO_CLIENT_ID);
    if (!anchor) return (void reply.code(422).send({ error: 'anchor_not_found' }), null);
    // 거리 기준점: 고른 장소·현재 위치(약 100m로 줄인 값). 이 요청 안에서만 쓰고 버린다 (저장·로그 없음)
    const at =
      a.type === 'place' || a.type === 'coords'
        ? { lat: Math.round(a.lat * 1000) / 1000, lng: Math.round(a.lng * 1000) / 1000 }
        : undefined;
    return {
      anchor,
      categories,
      domestic: parsed.data.domestic,
      keyword: keyword ?? undefined,
      at,
    };
  }

  /** 네이버 블로그 최신 글 (12개월 안, 링크로 중복 제거) */
  async function collect(
    anchor: string,
    category: AiCategory,
    keyword?: string,
  ): Promise<BlogPost[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const sinceYmd = since.toISOString().slice(0, 10).replace(/-/g, '');
    const posts = (
      await Promise.all(
        queriesFor(category, keyword).map((q) =>
          searchBlog(`${anchor} ${q}`, naver!, { max: 300, sinceYmd }),
        ),
      )
    ).flat();
    return [...new Map(posts.map((p) => [p.link, p])).values()].sort((a, b) =>
      b.postdate.localeCompare(a.postdate),
    );
  }

  // ① 수집 원자료 (관리자 점검용 — 블로그 사용량·하루 한도를 쓰므로 관리자만)
  app.post('/api/v1/ai/collect', { preHandler: requireAdmin(db) }, async (req, reply) => {
    const p = await prepare(req, reply);
    if (!p) return;
    const key = `collect|${p.anchor}|${p.categories.join(',')}|${p.keyword ?? ''}|${today()}`;
    const hit = getCache(key);
    if (hit) return JSON.parse(hit);
    const now = new Date();
    const result: { anchor: string; collectedAt: string; categories: Record<string, unknown> } = {
      anchor: p.anchor,
      collectedAt: now.toISOString(),
      categories: {},
    };
    for (const c of p.categories) {
      const posts = await collect(p.anchor, c, p.keyword);
      result.categories[c] = {
        queries: queriesFor(c, p.keyword).map((q) => `${p.anchor} ${q}`),
        byPeriod: countByPeriod(
          posts.map((x) => x.postdate),
          now,
        ),
        posts: posts.slice(0, 300),
      };
    }
    countUse(req.user!.userId);
    putCache(key, result);
    return result;
  });

  // ② 추천: 수집 → Groq 장소 추출 → 근거 검증·기간·점수 → (국내) 카카오로 위치 확인
  app.post('/api/v1/ai/recommend', { preHandler: requireUser(db) }, async (req, reply) => {
    const p = await prepare(req, reply);
    if (!p) return;
    const where = p.at ? `${p.at.lat},${p.at.lng}` : '';
    const key = `rec|${p.anchor}|${where}|${p.categories.join(',')}|${p.keyword ?? ''}|${p.domestic}|${today()}`;
    const hit = getCache(key);
    if (hit) return JSON.parse(hit);

    const now = new Date();
    const result: RecommendResult = {
      anchor: p.anchor,
      createdAt: now.toISOString(),
      categories: {},
      ...(p.keyword ? { keyword: p.keyword } : {}),
    };
    const kakao = config.KAKAO_CLIENT_ID;
    const gkey = config.GOOGLE_PLACES_KEY;
    // Google 장소 검색(과금 가능 — 무료 사용량 안에서만, API 사용량 자동 중지)
    const google = (q: string, near?: { lat: number; lng: number }): Promise<PlaceSummary[]> =>
      gkey && apiAllowed('google_places_search')
        ? searchGoogle(q, gkey, near).catch(() => [])
        : Promise.resolve([]);
    // 기준점 위치: 고른 장소·현재 위치 > 국내는 카카오(무료) > 해외는 Google(1회)
    const anchorAt =
      p.at ??
      (p.domestic && kakao
        ? (await searchKakao(p.anchor, kakao).catch(() => []))[0]?.coords
        : (await google(p.anchor))[0]?.coords) ??
      undefined;

    // 카테고리끼리 동시에: 블로그 수집·AI 정리 + 지도 후보 → 합치기 → 가까운 순 단계(5·10·50km)
    const done = await Promise.all(
      p.categories.map(async (c) => {
        const posts = (await collect(p.anchor, c, p.keyword))
          .slice(0, AI_POSTS)
          .map((x, i) => ({ ...x, id: `p${i}` }));
        const ai = await extractPlaces(
          providers,
          p.anchor,
          c,
          posts,
          (engine, err) => req.log.warn({ engine, err: String(err) }, 'ai engine failed'),
          p.keyword,
        );
        const engine = ai?.engine ?? 'basic';
        const extracted =
          ai?.places ?? (await basicExtract(p.anchor, c, posts, { kakao, naver }, p.keyword));
        const built = buildRecommendations(extracted, posts, now, CANDIDATES)[c];
        const word = mapWord(c, p.keyword);

        let recs: Rec[];
        if (p.domestic) {
          // 국내: 네이버 블로그(AI 정리) 먼저 → 카카오로 위치 확인 → 가까운 곳이 모자라면 Google 장소로 채움
          const find = (q: string, near?: { lat: number; lng: number }) =>
            kakao ? searchKakao(q, kakao, near).catch(() => []) : Promise.resolve([]);
          recs = await Promise.all(
            built.places.map(async (r): Promise<Rec> => {
              const place =
                (await find(`${p.anchor} ${r.name}`))[0] ?? (await find(r.name, anchorAt))[0];
              return place ? { ...r, place, origin: 'blog' } : { ...r, origin: 'blog' };
            }),
          );
          if (recs.filter((r) => nearOk(r, anchorAt, 10)).length < TOP)
            recs = addGoogle(recs, await google(`${p.anchor} ${word}`, anchorAt), c);
        } else {
          // 해외: Google 장소 검색 먼저(위치 정확) → 네이버 블로그 언급·요약을 이름으로 붙임 → 블로그에만 있는 곳은 뒤에
          const candidates = await google(`${p.anchor} ${word}`, anchorAt);
          recs = candidates.length
            ? mergeGoogleFirst(candidates, built.places, c)
            : built.places.map((r): Rec => ({ ...r, origin: 'blog' }));
        }
        const { radiusKm, items } = pickRadius(
          recs,
          (r) => (anchorAt && r.place?.coords ? distanceKm(anchorAt, r.place.coords) : null),
          ENOUGH,
        );
        return [
          c,
          { ...built, places: items.slice(0, TOP), engine, ...(anchorAt ? { radiusKm } : {}) },
        ] as const;
      }),
    );
    for (const [c, value] of done) result.categories[c] = value;
    countUse(req.user!.userId);
    putCache(key, result);
    return result;
  });

  app.get('/api/v1/ai/recommend/usage', { preHandler: requireUser(db) }, async (req) => {
    const used = usedToday(req.user!.userId);
    return { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) };
  });
}

/** 기준점에서 km 안 (위치를 모르면 일단 통과) */
function nearOk(r: Rec, at: { lat: number; lng: number } | undefined, km: number): boolean {
  return !at || !r.place?.coords || distanceKm(at, r.place.coords) <= km;
}

/** 이름이 같은 장소인가 ("이치란 신주쿠점" ≈ "이치란") — basicRecommend와 같은 규칙 */
function sameName(a: string, b: string): boolean {
  const na = namesOf(a);
  const nb = namesOf(b);
  return na.some((x) => nb.some((y) => x.includes(y) || y.includes(x)));
}

/** Google 결과를 근거 글 없는 추천으로 (언급 0, 요약 없음 — Google 정보는 AI에 보내지 않는다) */
const fromGoogle = (g: PlaceSummary, category: AiCategory): Rec => ({
  name: g.name,
  category,
  mentions: 0,
  lastMentioned: '',
  score: 0,
  adSuspect: false,
  summary: '',
  sources: [],
  place: g,
  origin: 'google',
});

/** 해외: Google 후보 순서를 기본으로, 블로그에서 언급된 곳은 언급·요약을 붙여 앞으로. 블로그에만 있는 곳은 뒤에 */
function mergeGoogleFirst(
  google: PlaceSummary[],
  blog: Recommendation[],
  category: AiCategory,
): Rec[] {
  const used = new Set<number>();
  const matched: Rec[] = [];
  const rest: Rec[] = [];
  for (const g of google) {
    const i = blog.findIndex((b, j) => !used.has(j) && sameName(g.name, b.name));
    if (i >= 0) {
      used.add(i);
      matched.push({ ...blog[i]!, name: g.name, place: g, origin: 'both' });
    } else rest.push(fromGoogle(g, category));
  }
  matched.sort((x, y) => y.score - x.score);
  const blogOnly = blog.filter((_, j) => !used.has(j)).map((b): Rec => ({ ...b, origin: 'blog' }));
  return [...matched, ...rest, ...blogOnly];
}

/** 국내: 블로그 추천 뒤에 Google 후보 중 아직 없는 곳을 붙인다 (이미 있으면 Google도 함께 찾았다고 표시) */
function addGoogle(recs: Rec[], google: PlaceSummary[], category: AiCategory): Rec[] {
  const out = [...recs];
  for (const g of google) {
    const i = out.findIndex(
      (r) => sameName(r.name, g.name) || norm(r.place?.name ?? '') === norm(g.name),
    );
    if (i >= 0) out[i] = { ...out[i]!, origin: 'both' };
    else out.push(fromGoogle(g, category));
  }
  return out;
}
