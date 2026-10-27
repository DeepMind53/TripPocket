import { RouteEtaBody } from '@trippocket/shared';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { apiAllowed } from '../services/apiUsage';
import { geoapifyEta, googleEta } from '../services/routes';

/**
 * 두 곳 사이 걸어서·대중교통 소요 시간 (일정 화면 "다음 일정" 바·구간 시간).
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
    // 실제 길 기준 시간: 걷기·대중교통 모두 Google Routes가 먼저 (Geoapify 대중교통은 일본 등에서 경로를 못 찾음, 2026-10-27).
    // Google이 멈췄거나 실패하면, Google 좌표가 아닐 때만 무료 Geoapify (Google 좌표는 다른 회사로 보내지 않는다 — 약관)
    if (gkey && apiAllowed('google_routes')) {
      try {
        const eta = await googleEta(from, to, gkey, live);
        if (eta.walk !== undefined || eta.transit !== undefined) return eta;
      } catch (e) {
        req.log.warn(`google routes 실패: ${String(e)}`);
      }
    }
    if (!google && okey && apiAllowed('geoapify')) {
      try {
        return await geoapifyEta(from, to, okey, live);
      } catch (e) {
        req.log.warn(`geoapify routing 실패: ${String(e)}`);
      }
    }
    return (
      reply
        .code(503)
        // 웹이 직선거리 어림으로 대신하므로 한도 팝업(api_paused)을 띄우지 않는다 (대체 기능 있음, 2026-10-27)
        .send({ error: 'no_route', api: google ? 'google_routes' : 'geoapify' })
    );
  });
}
