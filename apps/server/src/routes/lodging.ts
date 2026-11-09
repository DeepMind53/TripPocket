import type { FastifyInstance } from 'fastify';
import {
  HotelKeySchema,
  LodgingReportInputSchema,
  nightlyOf,
  REPORT_RULES,
  type LodgingReportInput,
} from '@trippocket/shared';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { lodgingReportsRepo } from '../repositories/lodgingReportsRepo';
import { latestFx } from '../services/fx';
import { requireAdmin } from './admin';

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
export function lodgingRoutes(app: FastifyInstance, db: Db): void {
  const auth = { preHandler: requireUser(db) };
  const repo = lodgingReportsRepo(db);

  app.get<{
    Querystring: { hotelKey?: string; checkIn?: string; nights?: string; adults?: string };
  }>(
    '/api/lodging/reports',
    { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const key = HotelKeySchema.safeParse(req.query.hotelKey);
      if (!key.success) return reply.code(400).send({ error: 'bad_request' });
      reply.header('cache-control', 'no-store');
      const num = (s: string | undefined) => (s && /^\d{1,2}$/.test(s) ? Number(s) : undefined);
      const checkIn = /^\d{4}-\d{2}-\d{2}$/.test(req.query.checkIn ?? '')
        ? req.query.checkIn
        : undefined;
      const nights = num(req.query.nights);
      const adults = num(req.query.adults);
      return {
        reports: repo.list(key.data, req.user!.userId, {
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
