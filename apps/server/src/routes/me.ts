import type { FastifyInstance } from 'fastify';
import { normalizeNickname, parseSettings, pickSynced } from '@trippocket/shared';
import type { Db } from '../db/database';
import type { Config } from '../config';
import { fixedAdmins } from '../auth/admins';
import { attachmentsDir, removeFiles } from '../services/attachments';
import { requireUser, SESSION_COOKIE } from '../auth/session';

/** 내 정보·로그인한 기기·탈퇴 (docs/09 §8). 모두 로그인 필요, 자기 것만 */
export function meRoutes(app: FastifyInstance, db: Db, config: Config): void {
  const auth = { preHandler: requireUser(db) };

  app.get('/api/me', auth, async (req) => {
    const userId = req.user!.userId;
    const user = db
      .prepare(
        'SELECT id, nickname, created_at, is_admin, nickname_set, public_no, hide_nickname FROM users WHERE id = ?',
      )
      .get(userId) as {
      id: string;
      nickname: string;
      created_at: string;
      is_admin: number;
      nickname_set: number;
      public_no: number;
      hide_nickname: number;
    };
    const points = db
      .prepare('SELECT COALESCE(SUM(delta), 0) AS n FROM point_ledger WHERE user_id = ?')
      .get(userId) as { n: number };
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
      // 후기 (docs/17): 가린 이름 번호·가리기 여부·포인트
      publicNo: user.public_no,
      hideNickname: !!user.hide_nickname,
      points: Number(points.n),
      ...(user.is_admin ? { isAdmin: true } : {}),
    };
  });

  // 내 설정 (계정에 저장 — 기기를 바꿔도 같게). 기기별 설정(테마·글자 크기·진동)은 받지도 주지도 않는다
  app.get('/api/me/settings', auth, async (req, reply) => {
    reply.header('cache-control', 'no-store');
    const row = db
      .prepare('SELECT data_json, updated_at FROM user_settings WHERE user_id = ?')
      .get(req.user!.userId) as { data_json: string; updated_at: string } | undefined;
    return row
      ? { data: pickSynced(parseSettings(JSON.parse(row.data_json))), updatedAt: row.updated_at }
      : { data: null, updatedAt: null };
  });

  // 올리기: 기기가 바꾼 시각(updatedAt)이 서버 것보다 나중일 때만 덮어쓴다 (오프라인에서 바꾼 것도 시각으로 비교)
  app.put<{ Body: { data?: unknown; updatedAt?: unknown } }>(
    '/api/me/settings',
    { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const at = req.body?.updatedAt;
      if (
        typeof at !== 'string' ||
        Number.isNaN(Date.parse(at)) ||
        Date.parse(at) > Date.now() + 60_000
      )
        return reply.code(400).send({ error: 'bad_request' });
      const data = pickSynced(parseSettings(req.body?.data));
      const cur = db
        .prepare('SELECT updated_at FROM user_settings WHERE user_id = ?')
        .get(req.user!.userId) as { updated_at: string } | undefined;
      if (!cur || cur.updated_at < at)
        db.prepare(
          `INSERT INTO user_settings (user_id, data_json, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
        ).run(req.user!.userId, JSON.stringify(data), at);
      const row = db
        .prepare('SELECT data_json, updated_at FROM user_settings WHERE user_id = ?')
        .get(req.user!.userId) as { data_json: string; updated_at: string };
      return { data: JSON.parse(row.data_json) as unknown, updatedAt: row.updated_at };
    },
  );

  // 닉네임 바꾸기: 공유한 여행의 멤버 목록·관리자 화면에 보이는 이름 (1~10자, 한글·한자·영어·숫자 — shared normalizeNickname)
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

  // 후기에서 닉네임 가리기 (docs/17 §2.5) — 이미 쓴 후기에도 바로 적용 (보여 줄 때 바꿈)
  app.patch<{ Body: { hideNickname?: unknown } }>(
    '/api/me/privacy',
    { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const hide = req.body?.hideNickname;
      if (typeof hide !== 'boolean') return reply.code(400).send({ error: 'bad_request' });
      db.prepare('UPDATE users SET hide_nickname = ? WHERE id = ?').run(
        hide ? 1 : 0,
        req.user!.userId,
      );
      return { hideNickname: hide };
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
  // 후기는 남기고 작성자만 User#N으로 (reviews.user_id ON DELETE SET NULL, 사용자 결정 2026-10-25)
  app.delete('/api/me', auth, async (req, reply) => {
    const userId = req.user!.userId;
    db.exec('BEGIN');
    try {
      // 올린 예약 문서 파일도 (docs/20 G2)
      const files = (
        db.prepare('SELECT id FROM attachments WHERE owner_user_id = ?').all(userId) as {
          id: string;
        }[]
      ).map((r) => r.id);
      removeFiles(attachmentsDir(config.DATA_DIR), files);
      db.prepare('DELETE FROM attachments WHERE owner_user_id = ?').run(userId);
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
