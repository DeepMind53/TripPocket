import { countByPeriod } from '@trippocket/shared';
import type { FastifyInstance } from 'fastify';
import * as z from 'zod/mini';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { resolveAnchor } from '../services/anchor';
import { searchBlog, type BlogPost } from '../services/naverBlog';

/** 카테고리별 검색어 (docs/14 §3-4) */
const QUERIES = {
  food: ['맛집'],
  cafe: ['카페', '핫플'],
  play: ['가볼만한곳', '놀거리'],
} as const;
type Category = keyof typeof QUERIES;

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
});

const DAILY_LIMIT = 20;
const CACHE_HOURS = 6;

/**
 * AI 추천 ① 수집 (20단계): 기준점 → 네이버 블로그 최신 글 → 기간별 개수. AI 정리·점수는 21단계.
 * 로그인 필요, 하루 횟수 제한, 같은 기준점·카테고리는 6시간 캐시. 좌표는 요청 본문으로만 (URL·로그에 남지 않게)
 */
export function aiRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const naver =
    (config.NAVER_SEARCH_ID ?? config.NAVER_CLIENT_ID) &&
    (config.NAVER_SEARCH_SECRET ?? config.NAVER_CLIENT_SECRET)
      ? {
          id: (config.NAVER_SEARCH_ID ?? config.NAVER_CLIENT_ID)!,
          secret: (config.NAVER_SEARCH_SECRET ?? config.NAVER_CLIENT_SECRET)!,
        }
      : null;

  app.post('/api/v1/ai/collect', { preHandler: requireUser(db) }, async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    if (!naver) return reply.code(503).send({ error: 'not_configured' });
    const userId = req.user!.userId;
    const today = new Date().toISOString().slice(0, 10);
    const used =
      (
        db
          .prepare('SELECT count FROM ai_usage WHERE user_id = ? AND date = ?')
          .get(userId, today) as { count: number } | undefined
      )?.count ?? 0;
    if (used >= DAILY_LIMIT)
      return reply.code(429).send({ error: 'daily_limit', limit: DAILY_LIMIT });

    const anchorName = await resolveAnchor(parsed.data.anchor, config.KAKAO_CLIENT_ID);
    if (!anchorName) return reply.code(422).send({ error: 'anchor_not_found' });

    const categories = [...new Set(parsed.data.categories)].sort() as Category[];
    const cacheKey = `${anchorName}|${categories.join(',')}|${today}`;
    const hit = db
      .prepare('SELECT result_json FROM ai_cache WHERE key = ? AND expires_at > ?')
      .get(cacheKey, new Date().toISOString()) as { result_json: string } | undefined;
    if (hit) return JSON.parse(hit.result_json);

    const now = new Date();
    const since = new Date(now);
    since.setMonth(since.getMonth() - 12);
    const sinceYmd = since.toISOString().slice(0, 10).replace(/-/g, '');
    const result: {
      anchor: string;
      collectedAt: string;
      categories: Record<
        string,
        { queries: string[]; byPeriod: Record<number, number>; posts: BlogPost[] }
      >;
    } = { anchor: anchorName, collectedAt: now.toISOString(), categories: {} };
    for (const c of categories) {
      const posts: BlogPost[] = [];
      for (const q of QUERIES[c])
        posts.push(...(await searchBlog(`${anchorName} ${q}`, naver, { max: 300, sinceYmd })));
      const unique = [...new Map(posts.map((p) => [p.link, p])).values()];
      result.categories[c] = {
        queries: QUERIES[c].map((q) => `${anchorName} ${q}`),
        byPeriod: countByPeriod(
          unique.map((p) => p.postdate),
          now,
        ),
        posts: unique.slice(0, 300),
      };
    }

    db.prepare(
      `INSERT INTO ai_usage (user_id, date, count) VALUES (?, ?, 1)
       ON CONFLICT (user_id, date) DO UPDATE SET count = count + 1`,
    ).run(userId, today);
    db.prepare('DELETE FROM ai_cache WHERE expires_at < ?').run(now.toISOString());
    db.prepare(
      'INSERT OR REPLACE INTO ai_cache (key, result_json, expires_at) VALUES (?, ?, ?)',
    ).run(
      cacheKey,
      JSON.stringify(result),
      new Date(now.getTime() + CACHE_HOURS * 3_600_000).toISOString(),
    );
    return result;
  });

  app.get('/api/v1/ai/recommend/usage', { preHandler: requireUser(db) }, async (req) => {
    const today = new Date().toISOString().slice(0, 10);
    const used =
      (
        db
          .prepare('SELECT count FROM ai_usage WHERE user_id = ? AND date = ?')
          .get(req.user!.userId, today) as { count: number } | undefined
      )?.count ?? 0;
    return { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) };
  });
}
