import { rankPlaces, type PlaceSummary } from '@trippocket/shared';
import type { FastifyInstance } from 'fastify';
import * as z from 'zod/mini';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { googleDetails, searchGoogle, searchKakao, searchNaver } from '../services/places';

/** 하루 한도 — 사람마다, 그리고 서버 전체 (Google 월 무료 사용량 안에 머물게) */
const PER_USER = { search: 200, google: 50, details: 20 } as const;
type Kind = keyof typeof PER_USER;

/** 같은 검색 반복 방지 (메모리 10분, 약관 범위 안 — 평점·영업시간은 캐시하지 않음) */
const cache = new Map<string, { exp: number; value: PlaceSummary[] }>();

/**
 * 장소 검색 프록시 (docs/10 §3.1, 로그인 필요). 국내 = 카카오·네이버(무료), 해외 = Google(무료 한도).
 * 좌표(여행지 기준)는 요청 본문으로만 받는다 — URL·로그에 남지 않게
 */
export function placesRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const auth = { preHandler: requireUser(db) };
  const naverKeys =
    (config.NAVER_SEARCH_ID ?? config.NAVER_CLIENT_ID) &&
    (config.NAVER_SEARCH_SECRET ?? config.NAVER_CLIENT_SECRET)
      ? {
          id: (config.NAVER_SEARCH_ID ?? config.NAVER_CLIENT_ID)!,
          secret: (config.NAVER_SEARCH_SECRET ?? config.NAVER_CLIENT_SECRET)!,
        }
      : null;
  const today = () => new Date().toISOString().slice(0, 10);
  const used = (userId: string, kind: Kind | `all-${Kind}`) =>
    (
      db
        .prepare('SELECT count FROM places_usage WHERE user_id = ? AND date = ? AND kind = ?')
        .get(userId, today(), kind) as { count: number } | undefined
    )?.count ?? 0;
  const bump = (userId: string, kind: string) =>
    db
      .prepare(
        `INSERT INTO places_usage (user_id, date, kind, count) VALUES (?, ?, ?, 1)
         ON CONFLICT (user_id, date, kind) DO UPDATE SET count = count + 1`,
      )
      .run(userId, today(), kind);
  /** 사람 한도 + 서버 전체 한도(Google) 둘 다 남았나 */
  const allowed = (userId: string, kind: Kind) =>
    used(userId, kind) < PER_USER[kind] &&
    (kind === 'search' ||
      used('*', `all-${kind}`) <
        (kind === 'google' ? config.GOOGLE_SEARCH_DAILY : config.GOOGLE_DETAILS_DAILY));

  const Body = z.object({
    q: z.string().check(z.minLength(1), z.maxLength(60)),
    scope: z.enum(['domestic', 'overseas']),
    near: z.optional(z.object({ lat: z.number(), lng: z.number() })),
  });

  app.post('/api/places/search', auth, async (req, reply) => {
    const body = Body.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    const { q, scope, near } = body.data;
    const userId = req.user!.userId;
    if (!allowed(userId, 'search')) return reply.code(429).send({ error: 'daily_limit' });
    const key = `${scope}|${q.trim().toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ''}`;
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return { places: hit.value, google: false };

    const found: PlaceSummary[] = [];
    let usedGoogle = false;
    const tasks: Promise<void>[] = [];
    if (scope === 'domestic') {
      if (config.KAKAO_CLIENT_ID)
        tasks.push(
          searchKakao(q, config.KAKAO_CLIENT_ID, near).then(
            (r) => void found.push(...r),
            () => {},
          ),
        );
      if (naverKeys)
        tasks.push(
          searchNaver(q, naverKeys).then(
            (r) => void found.push(...r),
            () => {},
          ),
        );
    }
    await Promise.all(tasks);
    // 해외이거나 국내 결과가 없으면 Google (무료 한도 안에서만)
    if (
      (scope === 'overseas' || found.length === 0) &&
      config.GOOGLE_PLACES_KEY &&
      allowed(userId, 'google')
    ) {
      try {
        found.push(...(await searchGoogle(q, config.GOOGLE_PLACES_KEY, near)));
        usedGoogle = true;
        bump(userId, 'google');
        bump('*', 'all-google');
      } catch (e) {
        req.log.warn({ err: String(e) }, 'google search failed');
      }
    }
    bump(userId, 'search');
    const places = rankPlaces(q, found);
    cache.set(key, { exp: Date.now() + 600_000, value: places });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return { places, google: usedGoogle };
  });

  // 평점·영업시간: 고른 Google 장소를 볼 때만 (저장 금지, 매번 조회 — docs/10 §2.1)
  app.get<{ Params: { id: string } }>('/api/places/google/:id', auth, async (req, reply) => {
    if (!config.GOOGLE_PLACES_KEY) return reply.code(503).send({ error: 'not_configured' });
    if (!/^[\w-]{10,300}$/.test(req.params.id))
      return reply.code(400).send({ error: 'bad_request' });
    const userId = req.user!.userId;
    if (!allowed(userId, 'details')) return reply.code(429).send({ error: 'daily_limit' });
    const details = await googleDetails(req.params.id, config.GOOGLE_PLACES_KEY);
    bump(userId, 'details');
    bump('*', 'all-details');
    reply.header('cache-control', 'no-store');
    return details;
  });
}
