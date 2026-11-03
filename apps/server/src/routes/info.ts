import { COUNTRY_ESSENTIALS } from '@trippocket/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as z from 'zod/mini';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { ApiPaused } from '../services/apiUsage';
import {
  airKoreaPm25,
  airlabsStatus,
  entryVisa,
  festivalsNear,
  periodDays,
  safetyNotices,
  SIDO,
} from '../services/publicInfo';
import { wikiSummary } from '../services/wikiSummary';
import { requireAdmin } from './admin';

const Query = z.object({ title: z.string().check(z.minLength(1), z.maxLength(60)) });
const Cc = z.string().check(z.regex(/^[A-Z]{2}$/));
const DateStr = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));
const FestBody = z.object({
  near: z.object({ lat: z.number(), lng: z.number() }),
  from: DateStr,
  to: DateStr,
});

/**
 * 여행 정보 (docs/26) — 로그인 필요.
 * 여행지 소개(위키백과), 외교부 안전공지·입국허가요건(관리자 점검), 국내 축제·행사, 국내 미세먼지, 항공편 지연
 */
export function infoRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const user = {
    preHandler: requireUser(db),
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };
  /** 외부 API 실패·중지·키 없음 → 503 (앱은 그 칸만 비움) */
  const unavailable = (req: FastifyRequest, reply: FastifyReply, err: unknown) => {
    if (!(err instanceof ApiPaused)) req.log.warn({ err: String(err) }, 'info api failed');
    return reply.code(503).send({ error: 'unavailable' });
  };
  const dataKey = config.DATA_GO_KR_KEY;

  app.get('/api/info/summary', user, async (req, reply) => {
    const parsed = Query.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
    try {
      return { summary: await wikiSummary(parsed.data.title) };
    } catch (err) {
      return unavailable(req, reply, err);
    }
  });

  // 외교부 안전공지 — 여행지 특보 카드 (나라 코드만 보냄)
  app.get<{ Params: { cc: string } }>('/api/info/safety/:cc', user, async (req, reply) => {
    const cc = Cc.safeParse(req.params.cc);
    if (!cc.success) return reply.code(400).send({ error: 'bad_request' });
    if (!dataKey) return reply.code(503).send({ error: 'unavailable' });
    try {
      return { notices: await safetyNotices(cc.data, dataKey) };
    } catch (err) {
      return unavailable(req, reply, err);
    }
  });

  // 국내 축제·행사 — 여행지 도시 좌표(본문으로만)·여행 날짜
  app.post('/api/info/festivals', user, async (req, reply) => {
    const body = FestBody.safeParse(req.body);
    if (!body.success || body.data.to < body.data.from)
      return reply.code(400).send({ error: 'bad_request' });
    if (!dataKey) return reply.code(503).send({ error: 'unavailable' });
    try {
      return {
        festivals: await festivalsNear(body.data.near, body.data.from, body.data.to, dataKey),
      };
    } catch (err) {
      return unavailable(req, reply, err);
    }
  });

  // 국내 오늘 미세먼지 (시도 평균)
  app.get<{ Querystring: { sido?: string } }>('/api/info/air-kr', user, async (req, reply) => {
    const sido = req.query.sido;
    if (!sido || !(SIDO as readonly string[]).includes(sido))
      return reply.code(400).send({ error: 'bad_request' });
    if (!dataKey) return reply.code(503).send({ error: 'unavailable' });
    try {
      return { air: await airKoreaPm25(sido, dataKey) };
    } catch (err) {
      return unavailable(req, reply, err);
    }
  });

  // 출발 당일 항공편 지연 (AirLabs, 편명만)
  app.get<{ Params: { no: string } }>('/api/info/flight/:no', user, async (req, reply) => {
    const no = req.params.no.toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9]{2}\d{1,4}$/.test(no)) return reply.code(400).send({ error: 'bad_request' });
    if (!config.AIRLABS_KEY) return reply.code(503).send({ error: 'unavailable' });
    try {
      return { status: await airlabsStatus(no, config.AIRLABS_KEY) };
    } catch (err) {
      return unavailable(req, reply, err);
    }
  });

  // 관리자 점검: 앱에 담은 무비자 기간 ↔ 외교부 입국허가요건 (다르면 표시 — 고치는 것은 사람이)
  app.get('/api/admin/entry-check', { preHandler: requireAdmin(db) }, async (req, reply) => {
    if (!dataKey) return reply.code(503).send({ error: 'unavailable' });
    const checks = [];
    try {
      for (const c of COUNTRY_ESSENTIALS) {
        const cc = c.codes[0]!;
        const v = await entryVisa(cc, dataKey);
        const official = v ? periodDays(v.period) : null;
        checks.push({
          country: c.name,
          code: cc,
          app: c.visaFreeDays ?? null,
          official,
          text: v?.period ?? '',
          match: v ? official === (c.visaFreeDays ?? null) : null,
        });
      }
    } catch (err) {
      return unavailable(req, reply, err);
    }
    return { checks };
  });
}
