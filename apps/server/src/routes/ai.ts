import {
  buildRecommendations,
  countByPeriod,
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
import { resolveAnchor } from '../services/anchor';
import { basicExtract } from '../services/basicRecommend';
import { extractPlaces, llmProviders, type LlmEngine } from '../services/llm';
import { naverSearchKeys, searchBlog, type BlogPost } from '../services/naverBlog';
import { searchKakao } from '../services/places';

/** 카테고리별 검색어 (docs/14 §3-4) */
const QUERIES: Record<AiCategory, readonly string[]> = {
  food: ['맛집'],
  cafe: ['카페', '핫플'],
  play: ['가볼만한곳', '놀거리'],
};

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
  ]),
  categories: z.array(z.enum(['food', 'cafe', 'play'])).check(z.minLength(1), z.maxLength(3)),
  /** 국내 여행이면 결과 장소를 카카오로 확인(좌표, 무료) */
  domestic: z._default(z.boolean(), false),
});

const DAILY_LIMIT = 20;
const CACHE_HOURS = 6;
/** 점수 계산에 쓰는 글 수 (카테고리마다, 최신순). AI에는 이 중 각 AI가 받을 수 있는 만큼만 (llm.ts) */
const AI_POSTS = 200;

export interface RecommendResult {
  anchor: string;
  createdAt: string;
  categories: Partial<
    Record<
      AiCategory,
      CategoryResult & {
        places: (Recommendation & { place?: PlaceSummary })[];
        /** 어느 AI가 정리했는지. basic = 모든 무료 AI가 한도 → AI 없이 언급 수로 집계 */
        engine: LlmEngine | 'basic';
      }
    >
  >;
}

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
    if (usedToday(req.user!.userId) >= DAILY_LIMIT)
      return (void reply.code(429).send({ error: 'daily_limit', limit: DAILY_LIMIT }), null);
    const anchor = await resolveAnchor(parsed.data.anchor, config.KAKAO_CLIENT_ID);
    if (!anchor) return (void reply.code(422).send({ error: 'anchor_not_found' }), null);
    const categories = [...new Set(parsed.data.categories)].sort() as AiCategory[];
    return { anchor, categories, domestic: parsed.data.domestic };
  }

  /** 네이버 블로그 최신 글 (12개월 안, 링크로 중복 제거) */
  async function collect(anchor: string, category: AiCategory): Promise<BlogPost[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const sinceYmd = since.toISOString().slice(0, 10).replace(/-/g, '');
    const posts: BlogPost[] = [];
    for (const q of QUERIES[category])
      posts.push(...(await searchBlog(`${anchor} ${q}`, naver!, { max: 300, sinceYmd })));
    return [...new Map(posts.map((p) => [p.link, p])).values()].sort((a, b) =>
      b.postdate.localeCompare(a.postdate),
    );
  }

  // ① 수집 원자료 (개발 확인용)
  app.post('/api/v1/ai/collect', { preHandler: requireUser(db) }, async (req, reply) => {
    const p = await prepare(req, reply);
    if (!p) return;
    const key = `collect|${p.anchor}|${p.categories.join(',')}|${today()}`;
    const hit = getCache(key);
    if (hit) return JSON.parse(hit);
    const now = new Date();
    const result: { anchor: string; collectedAt: string; categories: Record<string, unknown> } = {
      anchor: p.anchor,
      collectedAt: now.toISOString(),
      categories: {},
    };
    for (const c of p.categories) {
      const posts = await collect(p.anchor, c);
      result.categories[c] = {
        queries: QUERIES[c].map((q) => `${p.anchor} ${q}`),
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
    const key = `rec|${p.anchor}|${p.categories.join(',')}|${p.domestic}|${today()}`;
    const hit = getCache(key);
    if (hit) return JSON.parse(hit);

    const now = new Date();
    const result: RecommendResult = {
      anchor: p.anchor,
      createdAt: now.toISOString(),
      categories: {},
    };
    for (const c of p.categories) {
      const posts = (await collect(p.anchor, c))
        .slice(0, AI_POSTS)
        .map((x, i) => ({ ...x, id: `p${i}` }));
      const ai = await extractPlaces(providers, p.anchor, c, posts, (engine, err) =>
        req.log.warn({ engine, err: String(err) }, 'ai engine failed'),
      );
      const engine = ai?.engine ?? 'basic';
      const extracted =
        ai?.places ??
        (await basicExtract(p.anchor, c, posts, { kakao: config.KAKAO_CLIENT_ID, naver }));
      const built = buildRecommendations(extracted, posts, now)[c];
      const places: (Recommendation & { place?: PlaceSummary })[] = [];
      for (const r of built.places) {
        let place: PlaceSummary | undefined;
        if (p.domestic && config.KAKAO_CLIENT_ID) {
          try {
            place = (await searchKakao(`${p.anchor} ${r.name}`, config.KAKAO_CLIENT_ID))[0];
          } catch {
            // 위치 확인 실패 → 이름만 ("정보 확인 필요")
          }
        }
        places.push(place ? { ...r, place } : r);
      }
      result.categories[c] = { ...built, places, engine };
    }
    countUse(req.user!.userId);
    putCache(key, result);
    return result;
  });

  app.get('/api/v1/ai/recommend/usage', { preHandler: requireUser(db) }, async (req) => {
    const used = usedToday(req.user!.userId);
    return { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) };
  });
}
