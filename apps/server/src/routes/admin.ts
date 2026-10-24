import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { uuidv7 } from '@trippocket/shared';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { audit } from './auth';
import { revoke } from './reviews';
import { isApiId, isPausable, setApiLimit, setApiPaused, usageReport } from '../services/apiUsage';

/** 관리자만: 로그인 + users.is_admin (아니면 403) */
export function requireAdmin(db: Db) {
  const user = requireUser(db);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await user(req, reply);
    if (reply.sent) return;
    const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user!.userId) as
      { is_admin: number } | undefined;
    if (!row?.is_admin) return reply.code(403).send({ error: 'forbidden' });
  };
}

/** 요청 id = "제공자:계정번호" (로그인 방법별 계정 번호, 앱에는 그대로 보여 주지 않음) */
function splitRequestId(id: string): [string, string] | null {
  const i = id.indexOf(':');
  return i > 0 && i < id.length - 1 ? [id.slice(0, i), id.slice(i + 1)] : null;
}

/**
 * 사용자 관리 (관리자 = 첫 계정): 가입 요청 승인·거절, 사용 중지·다시 허용.
 * 승인하면 그 자리에서 계정을 만들어 두고, 그 사람이 다시 로그인하면 바로 쓸 수 있다
 */
export function adminRoutes(app: FastifyInstance, db: Db): void {
  const admin = { preHandler: requireAdmin(db) };

  app.get('/api/admin/users', admin, async () => {
    const requests = db
      .prepare(
        'SELECT provider, provider_user_id, nickname, status, requested_at FROM join_requests ORDER BY requested_at DESC',
      )
      .all() as {
      provider: string;
      provider_user_id: string;
      nickname: string;
      status: string;
      requested_at: string;
    }[];
    const users = db
      .prepare(
        `SELECT u.id, u.nickname, u.status, u.is_admin, u.created_at,
           (SELECT group_concat(provider) FROM oauth_accounts o WHERE o.user_id = u.id) AS providers,
           (SELECT max(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen_at
         FROM users u ORDER BY u.created_at`,
      )
      .all() as {
      id: string;
      nickname: string;
      status: string;
      is_admin: number;
      created_at: string;
      providers: string | null;
      last_seen_at: string | null;
    }[];
    return {
      requests: requests.map((r) => ({
        id: `${r.provider}:${r.provider_user_id}`,
        provider: r.provider,
        nickname: r.nickname,
        status: r.status,
        requestedAt: r.requested_at,
      })),
      users: users.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        status: u.status,
        isAdmin: !!u.is_admin,
        createdAt: u.created_at,
        providers: u.providers ? u.providers.split(',') : [],
        lastSeenAt: u.last_seen_at,
      })),
    };
  });

  app.post<{ Params: { id: string } }>(
    '/api/admin/requests/:id/approve',
    admin,
    async (req, reply) => {
      const key = splitRequestId(req.params.id);
      const row =
        key &&
        (db
          .prepare('SELECT nickname FROM join_requests WHERE provider = ? AND provider_user_id = ?')
          .get(...key) as { nickname: string } | undefined);
      if (!key || !row) return reply.code(404).send({ error: 'not_found' });
      const userId = uuidv7();
      db.exec('BEGIN');
      try {
        db.prepare('INSERT INTO users (id, nickname, created_at) VALUES (?, ?, ?)').run(
          userId,
          row.nickname,
          new Date().toISOString(),
        );
        db.prepare(
          'INSERT INTO oauth_accounts (provider, provider_user_id, user_id) VALUES (?, ?, ?)',
        ).run(key[0], key[1], userId);
        db.prepare('DELETE FROM join_requests WHERE provider = ? AND provider_user_id = ?').run(
          ...key,
        );
        audit(db, req.user!.userId, 'signup_approved', userId);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      return { ok: true, userId };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/admin/requests/:id/reject',
    admin,
    async (req, reply) => {
      const key = splitRequestId(req.params.id);
      const res = key
        ? db
            .prepare(
              "UPDATE join_requests SET status = 'rejected' WHERE provider = ? AND provider_user_id = ?",
            )
            .run(...key)
        : { changes: 0 };
      if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
      audit(db, req.user!.userId, 'signup_rejected', req.params.id);
      return { ok: true };
    },
  );

  // 사용 중지: 바로 로그아웃(세션 삭제) + 다시 로그인 불가. 서버 데이터는 남겨 두어 다시 허용할 수 있다
  app.post<{ Params: { id: string } }>(
    '/api/admin/users/:id/disable',
    admin,
    async (req, reply) => {
      const target = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.params.id) as
        { is_admin: number } | undefined;
      if (!target) return reply.code(404).send({ error: 'not_found' });
      // 관리자 자신은 막지 않는다 (아무도 관리할 수 없게 되는 것 방지)
      if (target.is_admin) return reply.code(400).send({ error: 'admin' });
      db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(req.params.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
      audit(db, req.user!.userId, 'user_disabled', req.params.id);
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>('/api/admin/users/:id/enable', admin, async (req, reply) => {
    const res = db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(req.params.id);
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    audit(db, req.user!.userId, 'user_enabled', req.params.id);
    return { ok: true };
  });

  // 후기 관리 (docs/17 §4): 최근 후기 보기, 부적절한 후기 숨기기(포인트 회수)·되돌리기
  app.get('/api/admin/reviews', admin, async () => ({
    reviews: db
      .prepare(
        `SELECT r.id, r.place_name, r.kind, r.ratings_json, r.note, r.hidden, r.created_at, r.author_no,
           u.nickname FROM reviews r LEFT JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 200`,
      )
      .all(),
  }));
  app.post<{ Params: { id: string }; Body: { hidden?: unknown } }>(
    '/api/admin/reviews/:id/hidden',
    admin,
    async (req, reply) => {
      const hidden = req.body?.hidden === true;
      const r = db
        .prepare('SELECT id, user_id, place_key, place_name, hidden FROM reviews WHERE id = ?')
        .get(req.params.id) as
        | {
            id: string;
            user_id: string | null;
            place_key: string | null;
            place_name: string;
            hidden: number;
          }
        | undefined;
      if (!r) return reply.code(404).send({ error: 'not_found' });
      if (hidden && !r.hidden && r.user_id) revoke(db, r.user_id, r, 'admin_hidden');
      db.prepare('UPDATE reviews SET hidden = ? WHERE id = ?').run(hidden ? 1 : 0, r.id);
      audit(db, req.user!.userId, hidden ? 'review_hide' : 'review_unhide', r.id);
      return { ok: true };
    },
  );

  // API 사용량: 이번 달(1일부터) 누적·하루별, 수동 중지·다시 켜기, 자동 중지 상한
  app.get('/api/admin/api-usage', admin, async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    return usageReport();
  });

  app.post<{
    Params: { id: string };
    Body: { paused?: unknown; limit?: unknown; dailyLimit?: unknown };
  }>('/api/admin/api-usage/:id', admin, async (req, reply) => {
    const id = req.params.id;
    if (!isApiId(id)) return reply.code(404).send({ error: 'not_found' });
    const { paused, limit, dailyLimit } = req.body ?? {};
    const okLimit = (v: unknown) => v === null || (Number.isInteger(v) && (v as number) >= 0);
    if (
      (paused !== undefined && (typeof paused !== 'boolean' || !isPausable(id))) ||
      (limit !== undefined && !okLimit(limit)) ||
      (dailyLimit !== undefined && !okLimit(dailyLimit))
    )
      return reply.code(400).send({ error: 'bad_request' });
    if (paused !== undefined) {
      setApiPaused(id, paused);
      audit(db, req.user!.userId, paused ? 'api_paused' : 'api_resumed', id);
    }
    if (limit !== undefined) {
      setApiLimit(id, limit as number | null, 'month');
      audit(db, req.user!.userId, 'api_limit', `${id}:${String(limit)}`);
    }
    if (dailyLimit !== undefined) {
      setApiLimit(id, dailyLimit as number | null, 'day');
      audit(db, req.user!.userId, 'api_daily_limit', `${id}:${String(dailyLimit)}`);
    }
    return usageReport();
  });
}
