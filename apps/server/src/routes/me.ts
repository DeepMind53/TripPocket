import type { FastifyInstance } from 'fastify';
import { normalizeNickname } from '@trippocket/shared';
import type { Db } from '../db/database';
import type { Config } from '../config';
import { fixedAdmins } from '../auth/admins';
import { requireUser, SESSION_COOKIE } from '../auth/session';

/** 내 정보·로그인한 기기·탈퇴 (docs/09 §8). 모두 로그인 필요, 자기 것만 */
export function meRoutes(app: FastifyInstance, db: Db, config: Config): void {
  const auth = { preHandler: requireUser(db) };

  app.get('/api/me', auth, async (req) => {
    const userId = req.user!.userId;
    const user = db
      .prepare('SELECT id, nickname, created_at, is_admin, nickname_set FROM users WHERE id = ?')
      .get(userId) as {
      id: string;
      nickname: string;
      created_at: string;
      is_admin: number;
      nickname_set: number;
    };
    const providers = db
      .prepare('SELECT provider FROM oauth_accounts WHERE user_id = ?')
      .all(userId)
      .map((r) => String(r.provider));
    return {
      id: user.id,
      nickname: user.nickname,
      createdAt: user.created_at,
      providers,
      // false = 로그인 서비스 이름 그대로 → 앱이 닉네임 정하기를 띄운다
      nicknameSet: !!user.nickname_set,
      ...(user.is_admin ? { isAdmin: true } : {}),
    };
  });

  // 닉네임 바꾸기: 공유한 여행의 멤버 목록·관리자 화면에 보이는 이름 (1~20자, shared normalizeNickname)
  app.patch<{ Body: { nickname?: unknown } }>(
    '/api/me/nickname',
    { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const nickname = normalizeNickname(req.body?.nickname);
      if (!nickname) return reply.code(400).send({ error: 'bad_nickname' });
      db.prepare('UPDATE users SET nickname = ?, nickname_set = 1 WHERE id = ?').run(
        nickname,
        req.user!.userId,
      );
      return { nickname };
    },
  );

  // 기기 목록: 세션 해시 앞 12자를 기기 id로 (해시 전체·토큰은 내보내지 않음)
  app.get('/api/me/sessions', auth, async (req) => {
    const rows = db
      .prepare(
        'SELECT id_hash, created_at, last_seen_at, user_agent FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC',
      )
      .all(req.user!.userId) as {
      id_hash: string;
      created_at: string;
      last_seen_at: string;
      user_agent: string;
    }[];
    return {
      sessions: rows.map((r) => ({
        id: r.id_hash.slice(0, 12),
        createdAt: r.created_at,
        lastSeenAt: r.last_seen_at,
        userAgent: r.user_agent,
        current: r.id_hash === req.user!.sessionHash,
      })),
    };
  });

  app.delete<{ Params: { id: string } }>('/api/me/sessions/:id', auth, async (req, reply) => {
    // 다른 사람 세션은 지울 수 없다 — 내 세션 중에서만 찾는다 (없으면 404)
    const res = db
      .prepare(
        'DELETE FROM sessions WHERE user_id = ? AND substr(id_hash, 1, 12) = ? AND length(?) = 12',
      )
      .run(req.user!.userId, req.params.id, req.params.id);
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    return { ok: true };
  });

  // 탈퇴: 서버 데이터 즉시 삭제 (docs/09 §7.6). 기기 데이터는 그대로 — 앱이 선택하게 한다
  app.delete('/api/me', auth, async (req, reply) => {
    const userId = req.user!.userId;
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM records WHERE owner_user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      // 관리자가 탈퇴하면 가장 먼저 가입한 사람이 관리자를 이어받는다 (관리자가 없어지지 않게)
      // (관리자 고정 목록이 있으면 넘기지 않는다 — 목록 밖 사람은 관리자가 될 수 없음)
      if (fixedAdmins(config).length === 0)
        db.exec(`UPDATE users SET is_admin = 1 WHERE NOT EXISTS (SELECT 1 FROM users WHERE is_admin = 1)
        AND id = (SELECT id FROM users WHERE status = 'active' ORDER BY created_at, id LIMIT 1)`);
      db.prepare('INSERT INTO audit_log (user_id, action, created_at) VALUES (?, ?, ?)').run(
        userId,
        'delete_account',
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}
