import type { FastifyInstance } from 'fastify';
import { apiAllowed, trackApi } from '../services/apiUsage';

/** IP 하나가 하루에 기록할 수 있는 지도 로드 수 — 부풀려서 자동 중지시키는 것 방지 (실사용은 하루 수십 회) */
export const MAP_LOADS_PER_IP_DAY = 100;

/** 키(IP)마다 하루 limit 번까지 true. 날짜가 바뀌면 비운다 (메모리에만, 저장·로그 안 함) */
export function dailyQuota(limit: number, now = () => new Date()): (key: string) => boolean {
  let day = '';
  const used = new Map<string, number>();
  return (key) => {
    const today = now().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used.clear();
    }
    const n = (used.get(key) ?? 0) + 1;
    used.set(key, n);
    return n <= limit;
  };
}

/**
 * 브라우저에서 직접 부르는 유료 가능 API(Google 지도)의 사용량 기록·허용 여부.
 * 로그인 없이도 지도를 보므로 공개, 대신 IP당 제한 (부풀리기 방지)
 */
export function usageRoutes(app: FastifyInstance): void {
  const allowLoad = dailyQuota(MAP_LOADS_PER_IP_DAY);

  // 지도를 불러와도 되나 (관리자가 멈췄거나 이번 달 자동 상한이면 false)
  app.get('/api/usage/flags', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    return { maps: apiAllowed('google_maps_js') };
  });

  // 지도 1회 로드 기록 (Google 과금 단위 = 지도 로드)
  app.post(
    '/api/usage/map-load',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req) => {
      // 한도를 넘은 IP는 기록하지 않는다 (응답은 같게)
      if (allowLoad(req.ip)) trackApi('google_maps_js');
      return { ok: true };
    },
  );
}
