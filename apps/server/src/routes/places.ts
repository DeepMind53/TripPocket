import { randomUUID } from 'node:crypto';
import { rankPlaces, type PlaceDetails, type PlaceSummary } from '@trippocket/shared';
import type { FastifyInstance } from 'fastify';
import * as z from 'zod/mini';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import {
  autocompleteGoogle,
  geoapifyLocalName,
  googleBasicDetails,
  googleDetails,
  googleLocalName,
  searchGeoapify,
  searchGoogle,
  searchKakao,
  searchNaver,
} from '../services/places';
import { naverSearchKeys } from '../services/naverBlog';
import { apiAllowed } from '../services/apiUsage';

/**
 * 사람마다 하루 검색 수 (카카오·네이버는 하루 무료량이 있어서).
 * Google 장소(검색·상세·현지어 이름)는 **월 단위로 과금**되므로 하루 한도 없이 월 무료량의 90%에서 자동 중지만
 * (services/apiUsage.ts, 사용자 결정 2026-10-26)
 */
const PER_USER = { search: 300 } as const;
type Kind = keyof typeof PER_USER;

/** 같은 검색 반복 방지 (메모리 10분, 약관 범위 안 — 평점·영업시간은 캐시하지 않음) */
const cache = new Map<string, { exp: number; value: PlaceSummary[] }>();

/**
 * 장소 검색 프록시 (docs/10 §3.1, 로그인 필요). 국내 = 카카오·네이버(무료), 해외 = Google(무료 한도).
 * 좌표(여행지 기준)는 요청 본문으로만 받는다 — URL·로그에 남지 않게
 */
export function placesRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const auth = { preHandler: requireUser(db) };
  const naverKeys = naverSearchKeys(config);
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
  /** 사람마다 하루 검색 수가 남았나 */
  const allowed = (userId: string, kind: Kind) => used(userId, kind) < PER_USER[kind];

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
    if (!allowed(userId, 'search'))
      return reply.code(429).send({ error: 'daily_limit', feature: 'places_search' });
    const key = `${scope}|${q.trim().toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ''}`;
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return { places: hit.value, google: false };

    const found: PlaceSummary[] = [];
    let usedGoogle = false;
    /** 어느 백업으로 찾았나 (docs/23): 화면에 "다른 검색으로 찾았어요"·출처 표기 */
    let fallback: 'google_autocomplete' | 'geoapify' | undefined;
    /** Google을 써야 했는데 한도·중지로 못 씀 → 결과가 없으면 이유를 알려 준다 (빈 목록으로 조용히 끝내지 않게) */
    let googleBlocked: 'api_paused' | null = null;
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
    // 해외이거나 국내 결과가 없으면 Google (무료 한도 안에서만).
    // 이번 달 무료량을 다 쓰면 남은 기간은 백업으로: Google 자동완성(무료 1만) → Geoapify(하루 3,000) (사용자 결정 2026-10-26)
    const needGoogle = scope === 'overseas' || found.length === 0;
    const gkey = config.GOOGLE_PLACES_KEY;
    if (needGoogle && gkey && apiAllowed('google_places_search')) {
      try {
        found.push(...(await searchGoogle(q, gkey, near)));
        usedGoogle = true;
      } catch (e) {
        req.log.warn({ err: String(e) }, 'google search failed');
      }
    } else if (needGoogle && gkey) googleBlocked = 'api_paused';
    if (needGoogle && !usedGoogle && gkey && apiAllowed('google_autocomplete')) {
      try {
        found.push(...(await autocompleteGoogle(q, gkey, randomUUID(), near)));
        usedGoogle = true;
        fallback = 'google_autocomplete';
      } catch (e) {
        req.log.warn({ err: String(e) }, 'google autocomplete failed');
      }
    }
    if (needGoogle && !usedGoogle && config.GEOAPIFY_KEY && apiAllowed('geoapify')) {
      try {
        found.push(...(await searchGeoapify(q, config.GEOAPIFY_KEY, near)));
        fallback = 'geoapify';
      } catch (e) {
        req.log.warn({ err: String(e) }, 'geoapify search failed');
      }
    }
    bump(userId, 'search');
    if (found.length === 0 && googleBlocked === 'api_paused' && !fallback)
      return reply.code(503).send({ error: 'api_paused', api: 'google_places_search' });
    const places = rankPlaces(q, found);
    // 자동완성 결과는 세션이 한 번 쓰고 끝나므로 캐시하지 않는다
    if (fallback !== 'google_autocomplete') {
      cache.set(key, { exp: Date.now() + 600_000, value: places });
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
    }
    return { places, google: usedGoogle, ...(fallback ? { fallback } : {}) };
  });

  // 평점·영업시간: 고른 Google 장소를 볼 때만 (저장 금지, 매번 조회 — docs/10 §2.1)
  app.get<{ Params: { id: string } }>('/api/places/google/:id', auth, async (req, reply) => {
    if (!config.GOOGLE_PLACES_KEY) return reply.code(503).send({ error: 'not_configured' });
    if (!/^[\w-]{10,300}$/.test(req.params.id))
      return reply.code(400).send({ error: 'bad_request' });
    reply.header('cache-control', 'no-store');
    // 이번 달 무료량(월 1,000)을 다 쓰면: 트립포켓 후기 별점 + Google 지도 링크 (사용자 결정 2026-10-26, docs/23 §2)
    if (!apiAllowed('google_places_details')) return ourRating(req.params.id);
    return googleDetails(req.params.id, config.GOOGLE_PLACES_KEY);
  });

  /** 그 장소 트립포켓 후기의 종합 별점 평균 (숨긴 후기 제외) */
  function ourRating(placeId: string): PlaceDetails {
    const row = db
      .prepare(
        `SELECT AVG(json_extract(ratings_json, '$.overall')) AS avg, COUNT(*) AS n
         FROM reviews WHERE hidden = 0 AND place_key = ?
           AND json_extract(ratings_json, '$.overall') IS NOT NULL`,
      )
      .get(`g:${placeId}`) as { avg: number | null; n: number };
    return {
      source: 'trippocket',
      ...(row.n > 0 && row.avg !== null
        ? { rating: Math.round(row.avg * 10) / 10, userRatingCount: row.n }
        : {}),
      googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`,
    };
  }

  // 자동완성 백업에서 고른 장소의 주소·좌표 (같은 세션 → 자동완성 요청 무료 처리, docs/23 §1)
  app.get<{ Params: { id: string }; Querystring: { session?: string } }>(
    '/api/places/google/:id/basic',
    auth,
    async (req, reply) => {
      if (!config.GOOGLE_PLACES_KEY) return reply.code(503).send({ error: 'not_configured' });
      const session = req.query.session;
      if (
        !/^[\w-]{10,300}$/.test(req.params.id) ||
        (session !== undefined && !/^[0-9a-f-]{36}$/.test(session))
      )
        return reply.code(400).send({ error: 'bad_request' });
      reply.header('cache-control', 'no-store');
      return googleBasicDetails(req.params.id, config.GOOGLE_PLACES_KEY, session);
    },
  );

  // 택시 카드 현지어 이름 (백업 포함): Google(월 5,000) → 다 쓰면 Geoapify 역지오코딩(좌표, 본문으로만 받음)
  const LocalBody = z.object({
    placeId: z.optional(z.string().check(z.regex(/^[\w-]{10,300}$/))),
    coords: z.optional(z.object({ lat: z.number(), lng: z.number() })),
    lang: z.string().check(z.regex(/^[a-z]{2,3}(-[A-Z]{2})?$/)),
  });
  app.post('/api/places/local', auth, async (req, reply) => {
    const body = LocalBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    const { placeId, coords, lang } = body.data;
    reply.header('cache-control', 'no-store');
    const gkey = config.GOOGLE_PLACES_KEY;
    if (placeId && gkey && apiAllowed('google_places_local'))
      return googleLocalName(placeId, lang, gkey);
    if (coords && config.GEOAPIFY_KEY && apiAllowed('geoapify'))
      return { ...(await geoapifyLocalName(coords, lang, config.GEOAPIFY_KEY)), source: 'osm' };
    return reply.code(503).send({ error: 'api_paused', api: 'google_places_local' });
  });

  // 택시용 현지어 이름·주소 (docs/20 G4) — 월 무료량 자동 중지만
  app.get<{ Params: { id: string }; Querystring: { lang?: string } }>(
    '/api/places/google/:id/local',
    auth,
    async (req, reply) => {
      if (!config.GOOGLE_PLACES_KEY) return reply.code(503).send({ error: 'not_configured' });
      const lang = req.query.lang ?? '';
      if (!/^[\w-]{10,300}$/.test(req.params.id) || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang))
        return reply.code(400).send({ error: 'bad_request' });
      const local = await googleLocalName(req.params.id, lang, config.GOOGLE_PLACES_KEY);
      reply.header('cache-control', 'no-store');
      return local;
    },
  );
}
