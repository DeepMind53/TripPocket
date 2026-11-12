import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { APIS, apiAllowed, isBrowserApi, trackApi, type ApiId } from '../services/apiUsage';

/**
 * 한 사람이 유료 지도(Google·네이버·카카오)를 하루에 열 수 있는 수 (실사용은 하루 수십 회).
 * 넘으면 그 사람에게는 유료 지도를 막아 무료 지도(OpenFreeMap)로 — 한 사람이 부풀려 모두의 지도를 멈추게 하지 못하게.
 * 2026-11-12: 예전에는 넘은 뒤 "기록만" 멈춰 지도는 열리는데 사용량이 덜 세졌다 → 이제 늘 기록하고, 대신 막는다
 */
export const MAP_LOADS_PER_IP_DAY = 100;

/** 키마다 오늘 센 수 (날짜가 바뀌면 비운다, 메모리에만 — 저장·로그 안 함) */
export function dailyQuota(limit: number, now = () => new Date()) {
  let day = '';
  const used = new Map<string, number>();
  const roll = () => {
    const today = now().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used.clear();
    }
  };
  return {
    /** 한 번 세고, 아직 한도 안이면 true */
    hit(key: string): boolean {
      roll();
      const n = (used.get(key) ?? 0) + 1;
      used.set(key, n);
      return n <= limit;
    },
    /** 세지 않고 한도가 남았나 */
    left(key: string): boolean {
      roll();
      return (used.get(key) ?? 0) < limit;
    },
  };
}

/** 브라우저에서 바로 부르는 외부 API (services/apiUsage.ts의 browser: true) */
const BROWSER_APIS = APIS.filter((a) => a.browser).map((a) => a.id);
/** 그중 결제 수단이 걸린 것 — 사람마다 하루 한도 */
const PAID_BROWSER = new Set(APIS.filter((a) => a.browser && a.group === 'paid').map((a) => a.id));

/**
 * 브라우저에서 바로 부르는 외부 API(지도 SDK·날씨·공휴일 등)의 허용 여부·사용 기록.
 * 로그인한 사람만 (2026-10-24 — 외부인이 지도 키를 쓰지 못하게, 로그인 안 하면 401 → 앱은 지도를 열지 않음).
 * 사람·API마다 하루 제한 (부풀려서 자동 중지시키는 것 방지)
 */
export function usageRoutes(app: FastifyInstance, db: Db): void {
  const quota = dailyQuota(MAP_LOADS_PER_IP_DAY);
  const auth = requireUser(db);

  // 지금 불러도 되나 (관리자가 멈췄거나 자동 상한이면 false, 유료 지도는 이 사람의 오늘 한도도)
  app.get('/api/usage/flags', { preHandler: auth }, async (req, reply) => {
    reply.header('cache-control', 'no-store');
    const user = req.user!.userId;
    const apis = Object.fromEntries(
      BROWSER_APIS.map((id) => [
        id,
        apiAllowed(id) && (!PAID_BROWSER.has(id) || quota.left(`${id}:${user}`)),
      ]),
    );
    // maps·naverMaps = 예전 앱 호환
    return { maps: apis.google_maps_js, naverMaps: apis.naver_maps_js, apis };
  });

  // 1회 사용 기록. body.api = API id (예전 앱: body.provider = google|naver, 없으면 google 지도)
  app.post(
    '/api/usage/map-load',
    { preHandler: auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req: FastifyRequest<{ Body: { provider?: unknown; api?: unknown } | undefined }>) => {
      const b = req.body ?? {};
      const id: ApiId | null = isBrowserApi(b.api)
        ? b.api
        : b.provider === 'naver'
          ? 'naver_maps_js'
          : b.api === undefined
            ? 'google_maps_js'
            : null;
      // 모르는 id는 기록하지 않는다. 아는 id는 한도를 넘었어도 늘 기록 (실제로 열린 지도 = 과금 단위)
      if (id) {
        quota.hit(`${id}:${req.user!.userId}`);
        trackApi(id);
      }
      return { ok: true };
    },
  );
}
