import { toPublicTrip, type Booking, type ItineraryItem, type Trip } from '@trippocket/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import * as z from 'zod/mini';
import type { Db } from '../db/database';
import { randomToken, requireUser, sha256 } from '../auth/session';
import { sendPush, type PushMessage } from '../services/push';

type Role = 'owner' | 'editor' | 'viewer';
const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };
const INVITE_DAYS = 7;
const INVITE_MAX_USES = 5;

/**
 * 공유·초대·멤버 (S-24/25/40/41, docs/09 §5·§8).
 * - 보기 전용 링크: 128bit 무작위 id, 언제든 끄기, 기본은 민감 정보 제외
 * - 초대 링크: 토큰은 해시만 저장, 7일·5회, 역할 지정, 소유자만
 * 권한이 없으면 404 (여행이 있는지 알려 주지 않음)
 */
/** 여행 이름 (서버에 동기화된 것) */
function tripTitleIn(db: Db, tripId: string): string {
  const r = db
    .prepare("SELECT data_json FROM records WHERE table_name = 'trips' AND id = ?")
    .get(tripId) as { data_json: string } | undefined;
  return r ? ((JSON.parse(r.data_json) as { title?: string }).title ?? '여행') : '여행';
}

export function shareRoutes(app: FastifyInstance, db: Db): void {
  const auth = { preHandler: requireUser(db) };
  const roleOf = (userId: string, tripId: string) =>
    (
      db
        .prepare('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?')
        .get(tripId, userId) as { role: Role } | undefined
    )?.role ?? null;
  const notFound = (reply: FastifyReply) => reply.code(404).send({ error: 'not_found' });
  const tripTitle = (tripId: string) => tripTitleIn(db, tripId);
  const nicknameOf = (userId: string) =>
    (
      db.prepare('SELECT nickname FROM users WHERE id = ?').get(userId) as
        { nickname: string } | undefined
    )?.nickname ?? '누군가';
  /** 그 여행의 소유자에게 알림 (공유 알림을 켠 기기만) */
  const notifyTrip = (tripId: string, role: Role, msg: (title: string) => PushMessage) => {
    const title = tripTitle(tripId);
    for (const m of db
      .prepare('SELECT user_id FROM trip_members WHERE trip_id = ? AND role = ?')
      .all(tripId, role) as { user_id: string }[])
      void sendPush(db, m.user_id, 'sharing', msg(title));
  };
  const now = () => new Date().toISOString();

  // ── 보기 전용 링크
  app.get<{ Params: { id: string } }>('/api/trips/:id/share', auth, async (req, reply) => {
    if (!roleOf(req.user!.userId, req.params.id)) return notFound(reply);
    const s = db
      .prepare('SELECT id, include_sensitive FROM shares WHERE trip_id = ? AND revoked_at IS NULL')
      .get(req.params.id) as { id: string; include_sensitive: number } | undefined;
    return { share: s ? { id: s.id, includeSensitive: !!s.include_sensitive } : null };
  });

  app.post<{ Params: { id: string } }>('/api/trips/:id/share', auth, async (req, reply) => {
    const role = roleOf(req.user!.userId, req.params.id);
    if (!role || RANK[role] < RANK.editor) return notFound(reply);
    const body = z.object({ includeSensitive: z.boolean() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    // 링크는 여행마다 하나 — 새로 만들면 예전 링크는 꺼진다
    db.prepare('UPDATE shares SET revoked_at = ? WHERE trip_id = ? AND revoked_at IS NULL').run(
      now(),
      req.params.id,
    );
    const id = randomToken(16);
    db.prepare(
      'INSERT INTO shares (id, trip_id, created_by, include_sensitive, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, req.params.id, req.user!.userId, body.data.includeSensitive ? 1 : 0, now());
    return { share: { id, includeSensitive: body.data.includeSensitive } };
  });

  app.delete<{ Params: { id: string } }>('/api/trips/:id/share', auth, async (req, reply) => {
    const role = roleOf(req.user!.userId, req.params.id);
    if (!role || RANK[role] < RANK.editor) return notFound(reply);
    db.prepare('UPDATE shares SET revoked_at = ? WHERE trip_id = ? AND revoked_at IS NULL').run(
      now(),
      req.params.id,
    );
    return { ok: true };
  });

  // 로그인 없이 보기 (링크를 아는 사람만)
  app.get<{ Params: { shareId: string } }>(
    '/api/public/shares/:shareId',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const s = db
        .prepare(
          'SELECT trip_id, include_sensitive FROM shares WHERE id = ? AND revoked_at IS NULL',
        )
        .get(req.params.shareId) as { trip_id: string; include_sensitive: number } | undefined;
      if (!s) return notFound(reply);
      const rows = db
        .prepare(
          'SELECT table_name, data_json FROM records WHERE trip_id = ? AND deleted_at IS NULL',
        )
        .all(s.trip_id) as { table_name: string; data_json: string }[];
      const of = <T>(t: string) =>
        rows.filter((r) => r.table_name === t).map((r) => JSON.parse(r.data_json) as T);
      const trip = of<Trip>('trips')[0];
      if (!trip) return notFound(reply);
      reply.header('cache-control', 'no-store');
      return toPublicTrip(
        trip,
        of<ItineraryItem>('items'),
        of<Booking>('bookings'),
        !!s.include_sensitive,
      );
    },
  );

  // ── 초대
  app.post<{ Params: { id: string } }>('/api/trips/:id/invites', auth, async (req, reply) => {
    if (roleOf(req.user!.userId, req.params.id) !== 'owner') return notFound(reply);
    const body = z.object({ role: z.enum(['editor', 'viewer']) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
    db.prepare(
      `INSERT INTO invites (token_hash, trip_id, role, expires_at, max_uses, used_count, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      sha256(token),
      req.params.id,
      body.data.role,
      expiresAt,
      INVITE_MAX_USES,
      req.user!.userId,
      now(),
    );
    return { token, expiresAt, role: body.data.role };
  });

  app.post<{ Params: { token: string } }>(
    '/api/invites/:token/accept',
    { preHandler: requireUser(db), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const inv = db
        .prepare(
          'SELECT trip_id, role, expires_at, max_uses, used_count FROM invites WHERE token_hash = ?',
        )
        .get(sha256(req.params.token)) as
        | { trip_id: string; role: Role; expires_at: string; max_uses: number; used_count: number }
        | undefined;
      if (!inv || inv.expires_at < now() || inv.used_count >= inv.max_uses)
        return reply.code(410).send({ error: 'invite_invalid' });
      const userId = req.user!.userId;
      const current = roleOf(userId, inv.trip_id);
      // 이미 그만한 권한이 있으면 그대로
      if (current && RANK[current] >= RANK[inv.role]) return { tripId: inv.trip_id, role: current };
      // 링크만으로는 권한이 생기지 않는다 — 소유자가 허용해야 (사용자 요청 2026-10-24, 링크 유출 대비)
      db.prepare(
        `INSERT INTO trip_join_requests (trip_id, user_id, role, requested_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (trip_id, user_id) DO UPDATE SET role = excluded.role, requested_at = excluded.requested_at`,
      ).run(inv.trip_id, userId, inv.role, now());
      db.prepare('UPDATE invites SET used_count = used_count + 1 WHERE token_hash = ?').run(
        sha256(req.params.token),
      );
      db.prepare(
        'INSERT INTO audit_log (user_id, action, target, created_at) VALUES (?, ?, ?, ?)',
      ).run(userId, 'invite_request', inv.trip_id, now());
      // 소유자에게 알림 (docs/20 G1)
      notifyTrip(inv.trip_id, 'owner', (title) => ({
        title: '여행 참여 요청',
        body: `${nicknameOf(userId)}님이 ${title} 참여를 요청했어요`,
        url: `/trips/${inv.trip_id}/plan`,
      }));
      return { tripId: inv.trip_id, status: 'pending', role: inv.role };
    },
  );

  // ── 멤버
  app.get<{ Params: { id: string } }>('/api/trips/:id/members', auth, async (req, reply) => {
    if (!roleOf(req.user!.userId, req.params.id)) return notFound(reply);
    const rows = db
      .prepare(
        `SELECT m.user_id, m.role, u.nickname FROM trip_members m JOIN users u ON u.id = m.user_id
         WHERE m.trip_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, m.created_at`,
      )
      .all(req.params.id) as { user_id: string; role: Role; nickname: string }[];
    // 참여 요청은 소유자에게만 보인다
    const requests =
      roleOf(req.user!.userId, req.params.id) === 'owner'
        ? (db
            .prepare(
              `SELECT r.user_id, r.role, r.requested_at, u.nickname FROM trip_join_requests r
               JOIN users u ON u.id = r.user_id WHERE r.trip_id = ? ORDER BY r.requested_at`,
            )
            .all(req.params.id) as {
            user_id: string;
            role: Role;
            requested_at: string;
            nickname: string;
          }[])
        : [];
    return {
      members: rows.map((r) => ({
        userId: r.user_id,
        nickname: r.nickname,
        role: r.role,
        me: r.user_id === req.user!.userId,
      })),
      requests: requests.map((r) => ({
        userId: r.user_id,
        nickname: r.nickname,
        role: r.role,
        requestedAt: r.requested_at,
      })),
    };
  });

  // 참여 요청 허용 (소유자만): 요청한 권한으로, 바꿔서 허용할 수도 있다
  app.post<{ Params: { id: string; userId: string }; Body: { role?: unknown } }>(
    '/api/trips/:id/requests/:userId/approve',
    auth,
    async (req, reply) => {
      if (roleOf(req.user!.userId, req.params.id) !== 'owner') return notFound(reply);
      const r = db
        .prepare('SELECT role FROM trip_join_requests WHERE trip_id = ? AND user_id = ?')
        .get(req.params.id, req.params.userId) as { role: Role } | undefined;
      if (!r) return notFound(reply);
      const role =
        req.body?.role === 'editor' || req.body?.role === 'viewer' ? req.body.role : r.role;
      db.exec('BEGIN');
      try {
        db.prepare(
          `INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (trip_id, user_id) DO UPDATE SET role = excluded.role`,
        ).run(req.params.id, req.params.userId, role, now());
        db.prepare('DELETE FROM trip_join_requests WHERE trip_id = ? AND user_id = ?').run(
          req.params.id,
          req.params.userId,
        );
        // 새 멤버의 기기는 이미 지난 rev까지 받았을 수 있다 → 이 여행의 행들에 새 rev를 매겨 다음 동기화에 내려가게
        // (rev마다 하나씩 — 같은 rev가 여러 행이면 pull 페이지 경계에서 빠질 수 있음)
        const ids = db
          .prepare('SELECT table_name, id FROM records WHERE trip_id = ?')
          .all(req.params.id) as { table_name: string; id: string }[];
        const bump = db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'rev'");
        const setRev = db.prepare(
          "UPDATE records SET rev = (SELECT value FROM counters WHERE name = 'rev') WHERE table_name = ? AND id = ?",
        );
        for (const r of ids) {
          bump.run();
          setRev.run(r.table_name, r.id);
        }
        db.prepare(
          'INSERT INTO audit_log (user_id, action, target, created_at) VALUES (?, ?, ?, ?)',
        ).run(req.user!.userId, 'invite_approve', `${req.params.id}:${req.params.userId}`, now());
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      // 요청한 사람에게 알림
      const title = tripTitle(req.params.id);
      void sendPush(db, req.params.userId, 'sharing', {
        title: '참여가 허용됐어요',
        body: `${title}을(를) 볼 수 있어요`,
        url: `/trips/${req.params.id}/plan`,
      });
      return { ok: true, role };
    },
  );

  // 참여 요청 거절 (소유자만)
  app.delete<{ Params: { id: string; userId: string } }>(
    '/api/trips/:id/requests/:userId',
    auth,
    async (req, reply) => {
      if (roleOf(req.user!.userId, req.params.id) !== 'owner') return notFound(reply);
      const res = db
        .prepare('DELETE FROM trip_join_requests WHERE trip_id = ? AND user_id = ?')
        .run(req.params.id, req.params.userId);
      if (res.changes === 0) return notFound(reply);
      return { ok: true };
    },
  );

  // 내 참여 요청이 기다리는 중인가 (초대 화면에서)
  app.get<{ Params: { id: string } }>('/api/trips/:id/my-request', auth, async (req) => {
    const r = db
      .prepare('SELECT role FROM trip_join_requests WHERE trip_id = ? AND user_id = ?')
      .get(req.params.id, req.user!.userId) as { role: Role } | undefined;
    return { pending: !!r, member: !!roleOf(req.user!.userId, req.params.id) };
  });

  app.patch<{ Params: { id: string; userId: string } }>(
    '/api/trips/:id/members/:userId',
    auth,
    async (req, reply) => {
      if (roleOf(req.user!.userId, req.params.id) !== 'owner') return notFound(reply);
      const body = z.object({ role: z.enum(['editor', 'viewer']) }).safeParse(req.body);
      if (!body.success || req.params.userId === req.user!.userId)
        return reply.code(400).send({ error: 'bad_request' });
      const res = db
        .prepare(
          "UPDATE trip_members SET role = ? WHERE trip_id = ? AND user_id = ? AND role <> 'owner'",
        )
        .run(body.data.role, req.params.id, req.params.userId);
      return res.changes ? { ok: true } : notFound(reply);
    },
  );

  // 소유자는 다른 멤버를 내보낼 수 있고, 멤버는 스스로 나갈 수 있다 (소유자는 못 나감)
  app.delete<{ Params: { id: string; userId: string } }>(
    '/api/trips/:id/members/:userId',
    auth,
    async (req, reply) => {
      const me = req.user!.userId;
      const myRole = roleOf(me, req.params.id);
      const self = req.params.userId === me;
      if (!myRole || (!self && myRole !== 'owner') || (self && myRole === 'owner'))
        return notFound(reply);
      const res = db
        .prepare("DELETE FROM trip_members WHERE trip_id = ? AND user_id = ? AND role <> 'owner'")
        .run(req.params.id, req.params.userId);
      return res.changes ? { ok: true } : notFound(reply);
    },
  );
}
