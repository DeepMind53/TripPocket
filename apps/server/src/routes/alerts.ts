import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { alertsFor } from '../services/alerts';

/**
 * 여행지 기상·재난 특보 (docs/24, ADR-0008): GET /api/alerts?countries=JP,TW (로그인 필요).
 * 나라 코드만 받는다 — 좌표·여행 정보는 받지 않는다
 */
export function alertRoutes(app: FastifyInstance, config: Config, db: Db): void {
  app.get<{ Querystring: { countries?: string } }>(
    '/api/alerts',
    { preHandler: requireUser(db), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const countries = [
        ...new Set((req.query.countries ?? '').toUpperCase().split(',').filter(Boolean)),
      ];
      if (
        !countries.length ||
        countries.length > 10 ||
        !countries.every((c) => /^[A-Z]{2}$/.test(c))
      )
        return reply.code(400).send({ error: 'bad_request' });
      reply.header('cache-control', 'private, max-age=300');
      return alertsFor(countries, config.DATA_GO_KR_KEY);
    },
  );
}
