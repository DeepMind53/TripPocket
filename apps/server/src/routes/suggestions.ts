import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { uuidv7 } from '@trippocket/shared';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { ATTACHMENT_MAX, safeId } from '../services/attachments';
import { sendPush } from '../services/push';
import { requireAdmin } from './admin';

const IMAGE = /^image\/(jpeg|png|webp|heic|heif|gif)$/;
const BODY_MAX = 2000;

interface Row {
  id: string;
  user_id: string | null;
  body: string;
  image_mime: string | null;
  status: string;
  reply: string | null;
  created_at: string;
  replied_at: string | null;
  nickname?: string | null;
}

const view = (r: Row, withAuthor = false) => ({
  id: r.id,
  body: r.body,
  hasImage: !!r.image_mime,
  status: r.status as 'new' | 'read' | 'done',
  reply: r.reply,
  createdAt: r.created_at,
  repliedAt: r.replied_at,
  ...(withAuthor ? { author: r.nickname ?? '탈퇴한 사용자' } : {}),
});

/**
 * 개선 제안 (마이 → 개선 제안, 사용자 요청 2026-10-25): 글 + 사진 1장(10MB) → 관리자에게.
 * 관리자에게 알림(공유 알림을 켠 기기), 관리자는 읽음·완료·답장. 사진은 DATA_DIR/suggestions/<id>
 */
export function suggestionRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const auth = { preHandler: requireUser(db) };
  const admin = { preHandler: requireAdmin(db) };
  const dir = () => {
    const d = join(config.DATA_DIR, 'suggestions');
    mkdirSync(d, { recursive: true });
    return d;
  };

  app.post<{ Body: { body?: unknown } }>(
    '/api/suggestions',
    { ...auth, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
      if (!body || body.length > BODY_MAX) return reply.code(400).send({ error: 'bad_request' });
      const id = uuidv7();
      db.prepare(
        "INSERT INTO suggestions (id, user_id, body, status, created_at) VALUES (?, ?, ?, 'new', ?)",
      ).run(id, req.user!.userId, body, new Date().toISOString());
      const nick =
        (
          db.prepare('SELECT nickname FROM users WHERE id = ?').get(req.user!.userId) as
            { nickname: string } | undefined
        )?.nickname ?? '';
      for (const a of db.prepare('SELECT id FROM users WHERE is_admin = 1').all() as {
        id: string;
      }[])
        void sendPush(db, a.id, 'sharing', {
          title: '새 개선 제안',
          body: `${nick}: ${body.slice(0, 60)}`,
          url: '/admin/suggestions',
        });
      return { id };
    },
  );

  // 사진 1장 (제안을 만든 뒤 붙임) — 본인 것만
  app.post<{ Params: { id: string }; Body: Buffer }>(
    '/api/suggestions/:id/image',
    {
      ...auth,
      bodyLimit: ATTACHMENT_MAX,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      if (!safeId(req.params.id)) return reply.code(404).send({ error: 'not_found' });
      const row = db
        .prepare('SELECT id FROM suggestions WHERE id = ? AND user_id = ?')
        .get(req.params.id, req.user!.userId);
      if (!row) return reply.code(404).send({ error: 'not_found' });
      const mime = String(req.headers['content-type'] ?? '')
        .split(';')[0]!
        .trim();
      if (!IMAGE.test(mime) || !Buffer.isBuffer(req.body))
        return reply.code(415).send({ error: 'unsupported_type' });
      if (req.body.length === 0 || req.body.length > ATTACHMENT_MAX)
        return reply.code(413).send({ error: 'too_large' });
      writeFileSync(join(dir(), req.params.id), req.body);
      db.prepare('UPDATE suggestions SET image_mime = ? WHERE id = ?').run(mime, req.params.id);
      return { ok: true };
    },
  );

  app.get('/api/suggestions/mine', auth, async (req) => ({
    suggestions: (
      db
        .prepare('SELECT * FROM suggestions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
        .all(req.user!.userId) as unknown as Row[]
    ).map((r) => view(r)),
  }));

  // ── 관리자
  app.get('/api/admin/suggestions', admin, async () => ({
    suggestions: (
      db
        .prepare(
          `SELECT s.*, u.nickname FROM suggestions s LEFT JOIN users u ON u.id = s.user_id
           ORDER BY s.created_at DESC LIMIT 200`,
        )
        .all() as unknown as Row[]
    ).map((r) => view(r, true)),
  }));

  const imageOf = async (id: string, reply: FastifyReply, userId?: string) => {
    if (!safeId(id)) return reply.code(404).send({ error: 'not_found' });
    const row = db
      .prepare(`SELECT image_mime FROM suggestions WHERE id = ?${userId ? ' AND user_id = ?' : ''}`)
      .get(...(userId ? [id, userId] : [id])) as { image_mime: string | null } | undefined;
    const file = join(dir(), id);
    if (!row?.image_mime || !existsSync(file)) return reply.code(404).send({ error: 'not_found' });
    reply.header('content-type', row.image_mime).header('cache-control', 'private, no-store');
    return reply.send(createReadStream(file));
  };
  app.get<{ Params: { id: string } }>('/api/admin/suggestions/:id/image', admin, (req, reply) =>
    imageOf(req.params.id, reply),
  );
  app.get<{ Params: { id: string } }>('/api/suggestions/:id/image', auth, (req, reply) =>
    imageOf(req.params.id, reply, req.user!.userId),
  );

  app.post<{ Params: { id: string }; Body: { status?: unknown; reply?: unknown } }>(
    '/api/admin/suggestions/:id',
    admin,
    async (req, reply) => {
      const row = db
        .prepare('SELECT * FROM suggestions WHERE id = ?')
        .get(req.params.id) as unknown as Row | undefined;
      if (!row) return reply.code(404).send({ error: 'not_found' });
      const status = ['new', 'read', 'done'].includes(String(req.body?.status))
        ? String(req.body!.status)
        : row.status;
      const text =
        typeof req.body?.reply === 'string' ? req.body.reply.trim().slice(0, BODY_MAX) : null;
      db.prepare(
        'UPDATE suggestions SET status = ?, reply = COALESCE(?, reply), replied_at = CASE WHEN ? IS NULL THEN replied_at ELSE ? END WHERE id = ?',
      ).run(status, text, text, new Date().toISOString(), row.id);
      // 답장하면 제안한 사람에게 알림
      if (text && row.user_id)
        void sendPush(db, row.user_id, 'sharing', {
          title: '개선 제안에 답장이 왔어요',
          body: text.slice(0, 80),
          url: '/me/suggestions',
        });
      return { ok: true };
    },
  );

  // 본인 제안 지우기 (사진도)
  app.delete<{ Params: { id: string } }>('/api/suggestions/:id', auth, async (req, reply) => {
    if (!safeId(req.params.id)) return reply.code(404).send({ error: 'not_found' });
    const res = db
      .prepare('DELETE FROM suggestions WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.userId);
    if (res.changes === 0) return reply.code(404).send({ error: 'not_found' });
    rmSync(join(dir(), req.params.id), { force: true });
    return { ok: true };
  });
}
