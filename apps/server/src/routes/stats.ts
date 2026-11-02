import type { FastifyInstance } from 'fastify';
import * as z from 'zod/mini';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { statDate, statsRepo } from '../repositories/statsRepo';
import { requireAdmin } from './admin';

/** 기능 이름: 영문·숫자와 . : / - _ 만 (화면 경로 "screen:/trips/:id" 같은 형태). 입력값이 섞이지 않게 */
const NAME = /^[a-z][a-zA-Z0-9_.:/-]{0,59}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** 한 사람이 하루에 보낼 수 있는 횟수 합 — 숫자를 부풀리는 것 방지 (실사용은 하루 수백) */
export const EVENTS_PER_USER_DAY = 5000;

const Body = z.object({
  days: z.record(z.string(), z.record(z.string(), z.number())),
});

/**
 * 사용 통계 (ADR-0009).
 * - POST /api/stats/events: 로그인한 앱이 기기에서 센 기능 사용 횟수를 모아 보낸다. 누가 보냈는지는 저장하지 않는다
 * - GET /api/admin/stats: 관리자만
 */
export function statsRoutes(app: FastifyInstance, db: Db): void {
  const stats = statsRepo(db);
  // 사람별 오늘 받은 횟수 (메모리에만 — 통계에는 사람 구분이 남지 않는다)
  let day = '';
  const used = new Map<string, number>();

  app.post(
    '/api/stats/events',
    {
      preHandler: requireUser(db),
      bodyLimit: 32 * 1024,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      const today = statDate();
      if (day !== today) {
        day = today;
        used.clear();
      }
      // 최근 7일 것만 (오래 오프라인이었던 기기)
      const oldest = statDate(new Date(Date.now() - 7 * 86_400_000));
      let budget = EVENTS_PER_USER_DAY - (used.get(req.user!.userId) ?? 0);
      let taken = 0;
      for (const [date, counts] of Object.entries(parsed.data.days).slice(0, 8)) {
        if (!DAY.test(date) || date < oldest || date > today) continue;
        for (const [key, raw] of Object.entries(counts).slice(0, 300)) {
          if (budget <= 0) break;
          const n = Math.min(Math.floor(raw), 500, budget);
          if (!NAME.test(key) || !(n > 0)) continue;
          // env.* = 기기 환경(하루 한 번), 그 밖 = 기능 사용
          stats.bump(key.startsWith('env.') ? 'env' : 'event', key, n, date);
          budget -= n;
          taken += n;
        }
      }
      used.set(req.user!.userId, (used.get(req.user!.userId) ?? 0) + taken);
      return { ok: true };
    },
  );

  app.get<{ Querystring: { days?: string } }>(
    '/api/admin/stats',
    { preHandler: requireAdmin(db) },
    async (req, reply) => {
      const days = Math.min(1096, Math.max(1, Number.parseInt(req.query.days ?? '7', 10) || 7));
      reply.header('cache-control', 'no-store');
      return stats.summary(days);
    },
  );
}
