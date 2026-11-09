import type { FastifyInstance } from 'fastify';
import {
  HOTEL_PRICE_RULES,
  HotelKeySchema,
  LodgingReportInputSchema,
  nightlyOf,
  REPORT_RULES,
  type LodgingReportInput,
} from '@trippocket/shared';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { lodgingReportsRepo } from '../repositories/lodgingReportsRepo';
import { latestFx } from '../services/fx';
import { agodaLookup, LookupPaused } from '../services/agodaLookup';
import { ApiPaused } from '../services/apiUsage';
import { hotelPrices, PricesPaused, type PriceQuery } from '../services/serpapiHotels';
import { statDate } from '../repositories/statsRepo';
import { requireAdmin } from './admin';

/** 자동 찾기 한도 (Q6 확정: 넉넉하게 — 검색 분당 5·하루 60) */
export const LOOKUP_RULES = { perMinute: 5, perDay: 60, concurrent: 2 } as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 참고 가격 검색 조건 검사 (docs/28 §8.2): 이름 1~80자, 체크아웃 > 체크인, 최대 30박, 인원 1~8 */
export function priceQueryOf(q: Record<string, string | undefined>): PriceQuery | null {
  const name = (q.name ?? '').trim();
  const { checkIn = '', checkOut = '' } = q;
  const adults = /^\d{1,2}$/.test(q.adults ?? '') ? Number(q.adults) : 0;
  if (!name || name.length > 80 || !DATE_RE.test(checkIn) || !DATE_RE.test(checkOut)) return null;
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000;
  if (!(nights >= 1 && nights <= HOTEL_PRICE_RULES.maxNights)) return null;
  if (adults < 1 || adults > HOTEL_PRICE_RULES.adultsMax) return null;
  return { name, checkIn, checkOut, adults };
}

/**
 * 1박 원화 환산이 정상 범위인지 (docs/28 §7.3). 환율을 모르는 통화는 금액 상한만 본다
 * (서버에 그 통화 환율이 없을 때 막지 않기 — 화면에서 "확인 필요"로 따로 거른다)
 */
function priceInRange(db: Db, r: LodgingReportInput): boolean {
  const nightly = nightlyOf(r);
  const rate = r.currency === 'KRW' ? 1 : latestFx(db)?.rates[r.currency];
  if (!rate) return true;
  const krw = nightly * rate;
  return krw >= REPORT_RULES.nightlyKrwMin && krw <= REPORT_RULES.nightlyKrwMax;
}

/**
 * 숙소 가격 기록 (docs/28 §7, ADR-0010). 모두 로그인 필요. 기록은 로그인한 모두가 보고, 누가 적었는지는 mine만.
 * 외부 요청 없음 — 우리 서버 DB만
 */
export function lodgingRoutes(app: FastifyInstance, db: Db, config: Config): void {
  const auth = { preHandler: requireUser(db) };
  const repo = lodgingReportsRepo(db);

  app.get<{
    Querystring: {
      hotelKey?: string;
      altKey?: string;
      checkIn?: string;
      nights?: string;
      adults?: string;
    };
  }>(
    '/api/lodging/reports',
    { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const key = HotelKeySchema.safeParse(req.query.hotelKey);
      if (!key.success) return reply.code(400).send({ error: 'bad_request' });
      // 같은 숙소를 아고다 번호·이름 두 열쇠로 적었을 수 있어 하나 더 받는다 (docs/28 §5)
      const alt = req.query.altKey ? HotelKeySchema.safeParse(req.query.altKey) : null;
      if (alt && !alt.success) return reply.code(400).send({ error: 'bad_request' });
      const keys = alt?.success && alt.data !== key.data ? [key.data, alt.data] : [key.data];
      reply.header('cache-control', 'no-store');
      const num = (s: string | undefined) => (s && /^\d{1,2}$/.test(s) ? Number(s) : undefined);
      const checkIn = /^\d{4}-\d{2}-\d{2}$/.test(req.query.checkIn ?? '')
        ? req.query.checkIn
        : undefined;
      const nights = num(req.query.nights);
      const adults = num(req.query.adults);
      return {
        reports: repo.list(keys, req.user!.userId, {
          ...(checkIn ? { checkIn } : {}),
          ...(nights ? { nights } : {}),
          ...(adults ? { adults } : {}),
        }),
      };
    },
  );

  app.post<{ Body: unknown }>(
    '/api/lodging/reports',
    { ...auth, config: { rateLimit: { max: REPORT_RULES.perMinute, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const me = req.user!.userId;
      const parsed = LodgingReportInputSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      if (!priceInRange(db, parsed.data)) return reply.code(422).send({ error: 'price_range' });
      if (repo.countToday(me) >= REPORT_RULES.perDay)
        return reply.code(429).send({ error: 'report_daily', limit: REPORT_RULES.perDay });
      return { report: repo.save(me, parsed.data) };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/lodging/reports/:id',
    { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!repo.remove(req.params.id, req.user!.userId))
        return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );

  // 아고다 숙소 자동 찾기 (docs/28 §4.2): 이름 → 숙소 후보 최대 3개. 외부 요청은 1번(캐시면 0)
  const lookups = new Map<string, { day: string; n: number }>();
  let running = 0;
  app.get<{ Querystring: { name?: string } }>(
    '/api/lodging/lookup',
    { ...auth, config: { rateLimit: { max: LOOKUP_RULES.perMinute, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const name = (req.query.name ?? '').trim();
      if (!name || name.length > 80) return reply.code(400).send({ error: 'bad_request' });
      const me = req.user!.userId;
      const day = statDate();
      const used = lookups.get(me);
      const n = used?.day === day ? used.n : 0;
      if (n >= LOOKUP_RULES.perDay)
        return reply.code(429).send({ error: 'lookup_daily', limit: LOOKUP_RULES.perDay });
      // 서버 전체 동시에 2개까지 (아고다에 몰아서 묻지 않게)
      if (running >= LOOKUP_RULES.concurrent) return reply.code(503).send({ error: 'busy' });
      running += 1;
      try {
        lookups.set(me, { day, n: n + 1 });
        reply.header('cache-control', 'no-store');
        return { candidates: await agodaLookup(name) };
      } catch (e) {
        if (e instanceof LookupPaused) return reply.code(503).send({ error: 'lookup_paused' });
        if (e instanceof ApiPaused) throw e;
        req.log.warn({ err: String(e) }, 'agoda lookup failed');
        return reply.code(502).send({ error: 'lookup_failed' });
      } finally {
        running -= 1;
      }
    },
  );

  // 구글 호텔 참고 가격 (docs/28 §4.3 B): 이름·날짜·인원 → 예약처별 가격. 외부 요청 최대 2번(캐시면 0), 저장 안 함
  const priceUses = new Map<string, { day: string; n: number }>();
  let pricing = 0;
  app.get<{ Querystring: Record<string, string | undefined> }>(
    '/api/lodging/prices',
    { ...auth, config: { rateLimit: { max: LOOKUP_RULES.perMinute, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const q = priceQueryOf(req.query);
      if (!q) return reply.code(400).send({ error: 'bad_request' });
      if (!config.SERPAPI_KEY) return reply.code(503).send({ error: 'prices_off' });
      const me = req.user!.userId;
      const day = statDate();
      const used = priceUses.get(me);
      const n = used?.day === day ? used.n : 0;
      if (n >= LOOKUP_RULES.perDay)
        return reply.code(429).send({ error: 'prices_daily', limit: LOOKUP_RULES.perDay });
      if (pricing >= LOOKUP_RULES.concurrent) return reply.code(503).send({ error: 'busy' });
      pricing += 1;
      try {
        priceUses.set(me, { day, n: n + 1 });
        reply.header('cache-control', 'no-store');
        return { hotel: await hotelPrices(config.SERPAPI_KEY, q) };
      } catch (e) {
        // 무료량 끝(우리 95% 상한 또는 SerpApi가 알림) → 화면은 구글 호텔 창 열기 버튼 (Q8)
        if (e instanceof ApiPaused || (e instanceof PricesPaused && e.quota))
          return reply.code(503).send({ error: 'prices_quota' });
        if (e instanceof PricesPaused) return reply.code(503).send({ error: 'prices_paused' });
        req.log.warn({ err: String(e) }, 'hotel prices failed');
        return reply.code(502).send({ error: 'prices_failed' });
      } finally {
        pricing -= 1;
      }
    },
  );

  // 관리자: 잘못된 기록 정리 (작성자는 보이지 않음)
  const admin = { preHandler: requireAdmin(db) };
  app.get('/api/admin/lodging/reports', admin, async () => repo.adminSummary());
  app.delete<{ Params: { id: string } }>(
    '/api/admin/lodging/reports/:id',
    admin,
    async (req, reply) => {
      if (!repo.remove(req.params.id, req.user!.userId, true))
        return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );
}
