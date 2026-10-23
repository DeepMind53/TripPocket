import type { FastifyInstance } from 'fastify';
import { apiAllowed, trackApi } from '../services/apiUsage';

/**
 * 브라우저에서 직접 부르는 유료 가능 API(Google 지도)의 사용량 기록·허용 여부.
 * 로그인 없이도 지도를 보므로 공개, 대신 IP당 제한 (부풀리기 방지)
 */
export function usageRoutes(app: FastifyInstance): void {
  // 지도를 불러와도 되나 (관리자가 멈췄거나 이번 달 자동 상한이면 false)
  app.get('/api/usage/flags', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    return { maps: apiAllowed('google_maps_js') };
  });

  // 지도 1회 로드 기록 (Google 과금 단위 = 지도 로드)
  app.post(
    '/api/usage/map-load',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async () => {
      trackApi('google_maps_js');
      return { ok: true };
    },
  );
}
