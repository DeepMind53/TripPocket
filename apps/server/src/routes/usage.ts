import type { FastifyInstance, FastifyRequest } from 'fastify';
import { APIS, apiAllowed, isBrowserApi, trackApi, type ApiId } from '../services/apiUsage';

/** IP 하나가 API마다 하루에 기록할 수 있는 수 — 부풀려서 자동 중지시키는 것 방지 (실사용은 하루 수십 회) */
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

/** 브라우저에서 바로 부르는 외부 API (services/apiUsage.ts의 browser: true) */
const BROWSER_APIS = APIS.filter((a) => a.browser).map((a) => a.id);

/**
 * 브라우저에서 바로 부르는 외부 API(지도 SDK·날씨·공휴일 등)의 허용 여부·사용 기록.
 * 로그인 없이도 쓰므로 공개, 대신 IP당 하루 제한 (부풀려서 자동 중지시키는 것 방지)
 */
export function usageRoutes(app: FastifyInstance): void {
  const allowHit = dailyQuota(MAP_LOADS_PER_IP_DAY);

  // 지금 불러도 되나 (관리자가 멈췄거나 자동 상한이면 false)
  app.get('/api/usage/flags', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    const apis = Object.fromEntries(BROWSER_APIS.map((id) => [id, apiAllowed(id)]));
    // maps·naverMaps = 예전 앱 호환
    return { maps: apis.google_maps_js, naverMaps: apis.naver_maps_js, apis };
  });

  // 1회 사용 기록. body.api = API id (예전 앱: body.provider = google|naver, 없으면 google 지도)
  app.post(
    '/api/usage/map-load',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req: FastifyRequest<{ Body: { provider?: unknown; api?: unknown } | undefined }>) => {
      const b = req.body ?? {};
      const id: ApiId | null = isBrowserApi(b.api)
        ? b.api
        : b.provider === 'naver'
          ? 'naver_maps_js'
          : b.api === undefined
            ? 'google_maps_js'
            : null;
      // 모르는 id·한도를 넘은 IP는 기록하지 않는다 (응답은 같게)
      if (id && allowHit(`${id}:${req.ip}`)) trackApi(id);
      return { ok: true };
    },
  );
}
