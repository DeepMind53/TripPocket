import { parsePush, SYNC_BATCH } from '@trippocket/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { syncRepo } from '../repositories/syncRepo';

/** 동기화 API (docs/09 §6.3). 로그인 필요, 권한은 syncRepo가 행마다 확인 */
export function syncRoutes(app: FastifyInstance, db: Db): void {
  const repo = syncRepo(db);
  const auth = { preHandler: requireUser(db) };

  app.post('/api/sync/push', auth, async (req, reply) => {
    const changes = parsePush(req.body);
    if (!changes) return reply.code(400).send({ error: 'bad_request' });
    return repo.push(req.user!.userId, changes);
  });

  app.get<{ Querystring: { since?: string; limit?: string } }>(
    '/api/sync/pull',
    auth,
    async (req) => {
      const since = Math.max(0, Number.parseInt(req.query.since ?? '0', 10) || 0);
      const limit = Math.min(
        SYNC_BATCH,
        Math.max(1, Number.parseInt(req.query.limit ?? '', 10) || SYNC_BATCH),
      );
      return repo.pull(req.user!.userId, since, limit);
    },
  );
}
