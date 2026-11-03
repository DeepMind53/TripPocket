import type { FastifyInstance } from 'fastify';
import * as z from 'zod/mini';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { ApiPaused } from '../services/apiUsage';
import { wikiSummary } from '../services/wikiSummary';

const Query = z.object({ title: z.string().check(z.minLength(1), z.maxLength(60)) });

/** 여행 정보 (docs/26) — 로그인 필요. 지금은 여행지 소개(위키백과 요약)만 */
export function infoRoutes(app: FastifyInstance, db: Db): void {
  app.get(
    '/api/info/summary',
    { preHandler: requireUser(db), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = Query.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      try {
        return { summary: await wikiSummary(parsed.data.title) };
      } catch (err) {
        if (!(err instanceof ApiPaused)) req.log.warn({ err: String(err) }, 'wiki summary failed');
        return reply.code(503).send({ error: 'unavailable' });
      }
    },
  );
}
