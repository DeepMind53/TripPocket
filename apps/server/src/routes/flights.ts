import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { lookupFlight } from '../services/flights';

/** 편명으로 항공편 불러오기 (로그인 필요, 사람당 분당 10회) — services/flights.ts */
export function flightRoutes(app: FastifyInstance, config: Config, db: Db): void {
  app.get<{ Params: { flightNo: string } }>(
    '/api/flights/:flightNo',
    { preHandler: requireUser(db), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!config.AVIATIONSTACK_KEY) return reply.code(503).send({ error: 'not_configured' });
      const flightNo = req.params.flightNo.replace(/\s+/g, '').toUpperCase();
      // 항공사 코드 2자(숫자 섞일 수 있음) + 편 번호 1~4자리
      if (!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(flightNo))
        return reply.code(400).send({ error: 'bad_flight_no' });
      const info = await lookupFlight(config.AVIATIONSTACK_KEY, flightNo);
      if (!info) return reply.code(404).send({ error: 'not_found' });
      return info;
    },
  );
}
