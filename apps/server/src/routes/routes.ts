import { RouteEtaBody } from '@trippocket/shared';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { apiAllowed } from '../services/apiUsage';
import { geoapifyEta, googleEta } from '../services/routes';

/**
 * 두 일정 장소 사이 걸어서·대중교통 소요 시간 (실험실 "출발 시각 알려 주기").
 * 좌표는 본문으로만 받고(주소창·로그에 남지 않게) 저장하지 않는다
 */
export function routeEtaRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const auth = {
    preHandler: requireUser(db),
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };
  app.post('/api/routes/eta', auth, async (req, reply) => {
    const body = RouteEtaBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    const { from, to, google, live = false } = body.data;
    reply.header('cache-control', 'no-store');
    const gkey = config.GOOGLE_PLACES_KEY;
    const okey = config.GEOAPIFY_KEY;
    // Google 좌표는 Google로만 (약관). 그 밖은 무료 Geoapify 먼저, 멈췄으면 Google
    if (!google && okey && apiAllowed('geoapify')) return geoapifyEta(from, to, okey, live);
    if (gkey && apiAllowed('google_routes')) return googleEta(from, to, gkey, live);
    return reply
      .code(503)
      .send({ error: 'api_paused', api: google ? 'google_routes' : 'geoapify' });
  });
}
