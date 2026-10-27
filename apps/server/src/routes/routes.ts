import { RouteEtaBody, type RouteEta } from '@trippocket/shared';
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
    // 실제 길 기준 시간: 걷기·대중교통 모두 Google Routes가 먼저 (2026-10-27).
    // Google은 나라마다 빈 곳이 있다 — 일본은 대중교통 없음, 한국은 도보 없음 (2026-10-27 실제 응답 확인).
    // 빈 쪽은 Google 좌표가 아닐 때만 무료 Geoapify로 채운다 (Google 좌표는 다른 회사로 보내지 않는다 — 약관)
    let eta: RouteEta | null = null;
    if (gkey && apiAllowed('google_routes')) {
      try {
        const g = await googleEta(from, to, gkey, live);
        if (g.walk !== undefined || g.transit !== undefined) eta = g;
      } catch (e) {
        req.log.warn(`google routes 실패: ${String(e)}`);
      }
    }
    const missing = !eta || eta.walk === undefined || eta.transit === undefined;
    if (missing && !google && okey && apiAllowed('geoapify')) {
      try {
        const o = await geoapifyEta(from, to, okey, live);
        eta = eta ? { ...eta, walk: eta.walk ?? o.walk, transit: eta.transit ?? o.transit } : o;
      } catch (e) {
        req.log.warn(`geoapify routing 실패: ${String(e)}`);
      }
    }
    if (eta && (eta.walk !== undefined || eta.transit !== undefined)) return eta;
    return (
      reply
        .code(503)
        // 웹이 직선거리 어림으로 대신하므로 한도 팝업(api_paused)을 띄우지 않는다 (대체 기능 있음, 2026-10-27)
        .send({ error: 'no_route', api: google ? 'google_routes' : 'geoapify' })
    );
  });
}
