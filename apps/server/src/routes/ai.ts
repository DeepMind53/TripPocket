import {
  buildRecommendations,
  countByPeriod,
  distanceKm,
  cleanShortText,
  inKorea,
  pickRadius,
  RADIUS_TIERS_KM,
  type AiCategory,
  type CategoryResult,
  type PlaceSummary,
  type Recommendation,
  type SourcePost,
} from '@trippocket/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as z from 'zod/mini';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { requireAdmin } from './admin';
import { resolveAnchor } from '../services/anchor';
import { basicExtract, namesOf, norm, widenSources, WORD } from '../services/basicRecommend';
import { extractPlaces, llmProviders, type LlmEngine } from '../services/llm';
import { naverSearchKeys, searchBlog, type BlogPost } from '../services/naverBlog';
import { searchGoogle, searchKakao } from '../services/places';
import { apiAllowed } from '../services/apiUsage';
import { statsRepo } from '../repositories/statsRepo';

/** 카테고리별 블로그 검색어 (docs/14 §3-4). custom = 사용자 키워드 그대로 */
const QUERIES: Record<Exclude<AiCategory, 'custom'>, readonly string[]> = {
  food: ['맛집'],
  cafe: ['카페', '핫플'],
  play: ['가볼만한곳', '놀거리'],
};
const queriesFor = (c: AiCategory, keyword?: string) =>
  c === 'custom' ? (keyword ? [keyword] : []) : QUERIES[c];
const mapWord = (c: AiCategory, keyword?: string) => (c === 'custom' ? (keyword ?? '') : WORD[c]);
/** 해외 지도 후보가 모자랄 때 기준점 좌표 주변을 이 말로 더 찾는다 */
const GOOGLE_NEARBY: Record<Exclude<AiCategory, 'custom'>, string> = {
  food: 'restaurant',
  cafe: 'cafe',
  play: 'tourist attraction',
};

const LatLng = z.object({
  lat: z.number().check(z.gte(-90), z.lte(90)),
  lng: z.number().check(z.gte(-180), z.lte(180)),
});

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
      // 호텔 이름만으로는 다른 나라 장소가 잡히므로 주소·여행 도시를 함께 받는다 (없어도 됨 — 구버전 앱)
      address: z.optional(z.string().check(z.maxLength(200))),
      area: z.optional(z.string().check(z.maxLength(60))),
      areaAt: z.optional(LatLng),
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
/** 보여 줄 장소 수, 거르기 전 후보 수. 거리는 기준점에서 5 → 10km, 10km 밖·위치 모르는 곳은 뺀다 (shared pickRadius) */
const TOP = 5;
const CANDIDATES = 15;
/** 이만큼 모이면 더 먼 단계로 넓히지 않는다 */
const ENOUGH = 3;
/** 찾은 숙소가 여행 도시에서 이보다 멀면 다른 곳으로 본다 */
const AREA_MAX_KM = 300;
/** 해외: 블로그에만 나온 곳 중 이만큼 언급된 곳은 Google로 위치를 찾아 본다 (카테고리당 최대 VERIFY_MAX번) */
const VERIFY_MIN_MENTIONS = 3;
const VERIFY_MAX = 5;
/** 해외: 인기 키워드 칸 — 키워드가 나온 글이 이만큼 이상일 때, 키워드 최대 2개 · 키워드당 3곳 */
const KEYWORD_MIN_POSTS = 3;
const KEYWORDS_MAX = 2;
const KEYWORD_PLACES = 3;
/** 정확도순으로 받을 글 수 (검색어마다). 최신순에 묻히는 소개 글을 함께 본다 */
const SIM_POSTS = 100;

export interface RecommendResult {
  anchor: string;
  createdAt: string;
  categories: Partial<
    Record<
      AiCategory,
      CategoryResult & {
        places: Rec[];
        /** 해외: 블로그 인기 키워드(장소 이름 아님)로 기준점 주변을 찾은 곳 — 장소 자체의 블로그 근거는 없다 */
        keywordPicks?: KeywordPick[];
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

/** 어디서 찾았나: blog = 네이버 블로그(AI 정리), google = Google 장소 검색, both = 둘 다, map = 카카오 장소 검색(국내) */
type Origin = 'blog' | 'google' | 'both' | 'map';
type Rec = Recommendation & { place?: PlaceSummary; origin: Origin };
interface KeywordPick {
  keyword: string;
  /** 키워드가 나온 글 수 */
  mentions: number;
  sources: SourcePost[];
  places: PlaceSummary[];
}

/**
 * AI 추천 (docs/14): ① 수집(20단계, 개발 화면) ② Groq 정리 + 점수(21단계).
 * 로그인 필요, 하루 20회, 같은 기준점·카테고리 6시간 캐시. 좌표는 본문으로만 받고 역 이름으로 바꾼 뒤 버린다
 */
export function aiRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const naver = naverSearchKeys(config);
  const providers = llmProviders(config);
  const stats = statsRepo(db);
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
    // 숙소: 주소·여행 도시 (위치 찾기·블로그 검색에만, 주소는 AI에 보내지 않는다)
    const lodging =
      a.type === 'lodging'
        ? {
            address: a.address?.trim() || undefined,
            area: (a.area && cleanShortText(a.area.trim(), 40)) || undefined,
            areaAt: a.areaAt,
          }
        : undefined;
    return {
      anchor,
      categories,
      domestic: parsed.data.domestic,
      keyword: keyword ?? undefined,
      at,
      lodging,
    };
  }

  /** 네이버 블로그 글 (12개월 안, 링크로 중복 제거): 정확도순과 최신순을 번갈아 — AI에는 앞쪽만 간다 */
  async function collect(
    anchors: readonly string[],
    category: AiCategory,
    keyword?: string,
  ): Promise<BlogPost[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const sinceYmd = since.toISOString().slice(0, 10).replace(/-/g, '');
    const queries = anchors.flatMap((a) => queriesFor(category, keyword).map((q) => `${a} ${q}`));
    const [bySim, byDate] = await Promise.all([
      Promise.all(
        queries.map((q) => searchBlog(q, naver!, { max: SIM_POSTS, sinceYmd, sort: 'sim' })),
      ),
      Promise.all(queries.map((q) => searchBlog(q, naver!, { max: 300, sinceYmd }))),
    ]);
    const sim = bySim.flat();
    const date = byDate.flat().sort((a, b) => b.postdate.localeCompare(a.postdate));
    const mixed = Array.from({ length: Math.max(sim.length, date.length) }, (_, i) => [
      ...(sim[i] ? [sim[i]] : []),
      ...(date[i] ? [date[i]] : []),
    ]).flat();
    return [...new Map(mixed.map((p) => [p.link, p])).values()];
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
      const posts = await collect([p.anchor], c, p.keyword);
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
    const stay = p.lodging ? `${p.lodging.address ?? ''}|${p.lodging.area ?? ''}` : '';
    const key = `rec|${p.anchor}|${where}|${stay}|${p.categories.join(',')}|${p.keyword ?? ''}|${p.domestic}|${today()}`;
    const hit = getCache(key);
    if (hit) {
      stats.bump('ai', 'cache.hit');
      return JSON.parse(hit);
    }
    stats.bump('ai', 'cache.miss');

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
    const google = (
      q: string,
      near?: { lat: number; lng: number },
      radius?: number,
    ): Promise<PlaceSummary[]> =>
      gkey && apiAllowed('google_places_search')
        ? searchGoogle(q, gkey, near, radius).catch(() => [])
        : Promise.resolve([]);
    const find = (q: string, near?: { lat: number; lng: number }) =>
      kakao ? searchKakao(q, kakao, near).catch(() => []) : Promise.resolve([]);
    const stayAt = p.lodging;
    /** 숙소는 도시를 붙여 찾는다 ("Vignette 리조트"만으로는 다른 나라 장소가 잡힌다) */
    const nameInArea = stayAt?.area ? `${stayAt.area} ${p.anchor}` : p.anchor;

    /** 해외: 찾은 곳이 한국이거나 여행 도시에서 너무 멀면 잘못 찾은 것으로 보고 버린다 */
    const locateOverseas = async (): Promise<PlaceSummary | undefined> => {
      const q = stayAt?.address ? `${p.anchor} ${stayAt.address}` : nameInArea;
      const found = (await google(q, stayAt?.areaAt))[0];
      if (!found?.coords || inKorea(found.coords)) return undefined;
      if (stayAt?.areaAt && distanceKm(stayAt.areaAt, found.coords) > AREA_MAX_KM) return undefined;
      return found;
    };
    /** 국내: 도시 + 이름 → 이름 → 주소 순서로 카카오(무료). Google은 쓰지 않는다 (사용자 결정 2026-11-02) */
    const locateDomestic = async (): Promise<PlaceSummary | undefined> =>
      (await find(nameInArea))[0] ??
      (stayAt
        ? ((await find(p.anchor))[0] ??
          (stayAt.address ? (await find(stayAt.address))[0] : undefined))
        : undefined);

    // 기준점 위치: 고른 장소·현재 위치 > 국내는 카카오 > 해외는 Google(1회)
    const located = p.at ? undefined : await (p.domestic ? locateDomestic() : locateOverseas());
    const anchorAt = p.at ?? located?.coords ?? undefined;
    const isAnchor = (g: PlaceSummary) => g.id === located?.id || norm(g.name) === norm(p.anchor);
    // 숙소면 호텔 이름 글이 적으므로 도시 이름으로도 블로그를 찾는다
    const blogAnchors = stayAt?.area ? [p.anchor, stayAt.area] : [p.anchor];
    // AI에는 이름만 (주소·좌표 없음). 숙소는 도시 이름만 — 글이 도시 단위라 호텔 이름을 주면 "근처"가 없다며 0곳이 된다
    // (거리는 서버가 지도로 거른다, 2026-11-02 분석)
    const aiAnchor = stayAt?.area ?? p.anchor;
    // 지도 검색어의 지역: 숙소는 도시, 그 밖은 기준점 이름
    const mapArea = stayAt?.area ?? p.anchor;

    // 카테고리끼리 동시에: 블로그 수집·AI 정리 + 지도 후보 → 합치기 → 가까운 순 단계(5·10km)
    const done = await Promise.all(
      p.categories.map(async (c) => {
        const posts = (await collect(blogAnchors, c, p.keyword))
          .slice(0, AI_POSTS)
          .map((x, i) => ({ ...x, id: `p${i}` }));
        const ai = await extractPlaces(
          providers,
          aiAnchor,
          c,
          posts,
          (engine, err) => req.log.warn({ engine, err: String(err) }, 'ai engine failed'),
          p.keyword,
        );
        let engine: LlmEngine | 'basic' = ai?.engine ?? 'basic';
        // 언급 수: AI가 이은 글 + 이름이 그대로 나온 글 (서버가 다시 셈)
        let built = buildRecommendations(
          widenSources(ai?.places ?? [], posts),
          posts,
          now,
          CANDIDATES,
        )[c];
        // AI가 실패했거나 근거 있는 곳을 하나도 못 찾으면 AI 없는 집계로
        if (built.places.length === 0) {
          const basic = buildRecommendations(
            await basicExtract(mapArea, c, posts, { kakao, naver }, p.keyword),
            posts,
            now,
            CANDIDATES,
          )[c];
          if (basic.places.length > 0 || !ai) {
            built = basic;
            engine = 'basic';
          }
        }

        let recs: Rec[];
        if (p.domestic) {
          // 국내: 네이버 블로그(AI 정리) 먼저 → 카카오로 위치 확인 → 10km 안이 모자라면 카카오 장소로 채움
          recs = await Promise.all(
            built.places.map(async (r): Promise<Rec> => {
              const place =
                (await find(`${mapArea} ${r.name}`))[0] ?? (await find(r.name, anchorAt))[0];
              return place ? { ...r, place, origin: 'blog' } : { ...r, origin: 'blog' };
            }),
          );
          const nearby = recs.filter(
            (r) =>
              anchorAt &&
              r.place?.coords &&
              distanceKm(anchorAt, r.place.coords) <= RADIUS_TIERS_KM.at(-1)!,
          );
          if (anchorAt && nearby.length < TOP) {
            const fill = (await find(`${mapArea} ${mapWord(c, p.keyword)}`, anchorAt)).filter(
              (g) => !isAnchor(g) && !recs.some((r) => sameName(g.name, r.name)),
            );
            recs = [...recs, ...fill.map((g) => fromMapSearch(g, c, 'map'))];
          }
        } else {
          // 해외: Google 장소 검색 먼저(위치 정확) → 네이버 블로그 언급·요약을 이름으로 붙임 → 블로그에만 있는 곳은 뒤에
          // 지역 이름 + 한국어 검색어를 기준점 주변으로 찾고, 모자라면 그 주변을 종류로 더 찾는다
          const byName = (await google(`${mapArea} ${mapWord(c, p.keyword)}`, anchorAt)).filter(
            (g) => !isAnchor(g),
          );
          const byKind =
            anchorAt && c !== 'custom' && byName.length < ENOUGH
              ? (await google(GOOGLE_NEARBY[c], anchorAt, RADIUS_TIERS_KM[0] * 1000)).filter(
                  (g) => !isAnchor(g) && !byName.some((x) => x.id === g.id),
                )
              : [];
          const candidates = [...byName, ...byKind];
          recs = candidates.length
            ? mergeGoogleFirst(candidates, built.places, c)
            : built.places.map((r): Rec => ({ ...r, origin: 'blog' }));
          // 블로그에만 나온 곳: 많이 언급된 곳만 Google로 위치 확인 (위치를 모르면 10km 거르기에서 빠진다)
          if (anchorAt) {
            const at = anchorAt;
            const toVerify = recs
              .filter((r) => r.origin === 'blog' && !r.place && r.mentions >= VERIFY_MIN_MENTIONS)
              .slice(0, VERIFY_MAX);
            const found = await Promise.all(
              toVerify.map(async (r) =>
                (await google(r.localName ?? r.name, at, RADIUS_TIERS_KM[0] * 1000)).find(
                  (g) =>
                    !isAnchor(g) &&
                    !!g.coords &&
                    distanceKm(at, g.coords) <= RADIUS_TIERS_KM.at(-1)! &&
                    !recs.some((x) => x.place?.id === g.id),
                ),
              ),
            );
            const placed = new Map(toVerify.map((r, i) => [r, found[i]]));
            recs = recs.map((r): Rec => {
              const g = placed.get(r);
              return g ? { ...r, place: g, origin: 'both' } : r;
            });
            // 블로그 근거가 있는 곳을 앞으로 (점수순), 지도 검색으로만 찾은 곳은 뒤로
            recs = [
              ...recs.filter((r) => r.origin === 'both').sort((x, y) => y.score - x.score),
              ...recs.filter((r) => r.origin !== 'both'),
            ];
          }
        }

        // 해외: 블로그 인기 키워드(예: 규카츠)로 기준점 주변 찾기 — 장소 이름이 블로그와 달라도 추천이 나온다
        const keywordPicks: KeywordPick[] = [];
        if (!p.domestic && anchorAt && ai && c !== 'custom') {
          const at = anchorAt;
          const byId = new Map(posts.map((x) => [x.id, x]));
          const words = ai.keywords
            .map((k) => ({
              word: k.word.trim(),
              sources: [...new Set(k.sourceIds)]
                .map((id) => byId.get(id))
                .filter((x): x is (typeof posts)[number] => !!x),
            }))
            .filter((k) => k.word && k.sources.length >= KEYWORD_MIN_POSTS)
            .slice(0, KEYWORDS_MAX);
          for (const k of words) {
            const near = (await google(k.word, at, RADIUS_TIERS_KM[0] * 1000)).filter(
              (g) =>
                !isAnchor(g) &&
                !!g.coords &&
                distanceKm(at, g.coords) <= RADIUS_TIERS_KM.at(-1)! &&
                !recs.some((r) => r.place?.id === g.id),
            );
            if (near.length === 0) continue;
            keywordPicks.push({
              keyword: k.word,
              mentions: k.sources.length,
              sources: k.sources
                .sort((a, b) => b.postdate.localeCompare(a.postdate))
                .slice(0, 5)
                .map(({ id, title, link, postdate }) => ({ id, title, link, postdate })),
              places: near.slice(0, KEYWORD_PLACES),
            });
          }
        }
        const { radiusKm, items } = pickRadius(
          recs,
          (r) => (anchorAt && r.place?.coords ? distanceKm(anchorAt, r.place.coords) : null),
          ENOUGH,
          undefined,
          // 기준점 위치를 알면 10km 안인지 확인된 곳만 (사용자 요청 2026-10-27)
          !anchorAt,
        );
        return [
          c,
          {
            ...built,
            places: items.slice(0, TOP),
            engine,
            ...(anchorAt ? { radiusKm } : {}),
            ...(keywordPicks.length ? { keywordPicks } : {}),
          },
        ] as const;
      }),
    );
    for (const [c, value] of done) {
      result.categories[c] = value;
      // 추천 품질: 정리한 AI(basic = AI 없이 집계), 0곳, 블로그 근거가 있는 곳 수
      stats.bump('ai', `engine.${value.engine}`);
      if (value.places.length === 0) stats.bump('ai', 'empty');
      stats.bump('ai', 'keywordPicks', value.keywordPicks?.length ?? 0);
      stats.bump('ai', 'places', value.places.length);
      stats.bump('ai', 'withBlog', value.places.filter((x) => x.mentions > 0).length);
    }
    // 한 곳도 못 찾았으면 하루 횟수를 쓰지 않고, 빈 결과가 6시간 남지 않게 저장도 하지 않는다
    if (done.some(([, value]) => value.places.length > 0)) {
      countUse(req.user!.userId);
      putCache(key, result);
    }
    return result;
  });

  app.get('/api/v1/ai/recommend/usage', { preHandler: requireUser(db) }, async (req) => {
    const used = usedToday(req.user!.userId);
    return { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) };
  });
}

/** 이름이 같은 장소인가 ("이치란 신주쿠점" ≈ "이치란") — basicRecommend와 같은 규칙 */
function sameName(a: string, b: string): boolean {
  const na = namesOf(a);
  const nb = namesOf(b);
  return na.some((x) => nb.some((y) => x.includes(y) || y.includes(x)));
}

/** 지도 검색 결과를 근거 글 없는 추천으로 (언급 0, 요약 없음 — 지도 정보는 AI에 보내지 않는다) */
const fromMapSearch = (g: PlaceSummary, category: AiCategory, origin: Origin): Rec => ({
  name: g.name,
  category,
  mentions: 0,
  lastMentioned: '',
  score: 0,
  adSuspect: false,
  summary: '',
  sources: [],
  place: g,
  origin,
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
    // 블로그 이름 또는 AI가 알려 준 현지어 이름으로 맞춘다 ("이치란" ≈ "一蘭")
    const i = blog.findIndex(
      (b, j) =>
        !used.has(j) &&
        (sameName(g.name, b.name) || (!!b.localName && sameName(g.name, b.localName))),
    );
    if (i >= 0) {
      used.add(i);
      matched.push({ ...blog[i]!, name: g.name, place: g, origin: 'both' });
    } else rest.push(fromMapSearch(g, category, 'google'));
  }
  matched.sort((x, y) => y.score - x.score);
  const blogOnly = blog.filter((_, j) => !used.has(j)).map((b): Rec => ({ ...b, origin: 'blog' }));
  return [...matched, ...rest, ...blogOnly];
}
