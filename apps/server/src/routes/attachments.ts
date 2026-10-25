import { createReadStream, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { todayIn, uuidv7 } from '@trippocket/shared';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import {
  ATTACHMENT_MAX,
  ATTACHMENT_TYPES,
  attachmentsDir,
  removeFiles,
  safeId,
} from '../services/attachments';

interface Row {
  id: string;
  trip_id: string;
  booking_id: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}

/**
 * 예약 문서(이티켓·바우처 PDF·사진) — docs/20 G2. 로그인 + 여행 멤버만.
 * 올리기·지우기는 소유자·편집자, 보기는 멤버 모두. 1개 10MB, 끝난 여행은 받지 않음(기기에만)
 * 서버에서 데이터를 지우는 관리 기능은 HTTP로 열지 않는다 — 서버 PC의 `pnpm admin:data`로만
 */
export function attachmentRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const auth = { preHandler: requireUser(db) };
  const dir = () => attachmentsDir(config.DATA_DIR);
  const roleIn = (tripId: string, userId: string) =>
    (
      db
        .prepare('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?')
        .get(tripId, userId) as { role: string } | undefined
    )?.role;
  const tripEnded = (tripId: string) => {
    const r = db
      .prepare("SELECT data_json FROM records WHERE table_name = 'trips' AND id = ?")
      .get(tripId) as { data_json: string } | undefined;
    if (!r) return true;
    const t = JSON.parse(r.data_json) as { endDate?: string; timezone?: string };
    try {
      return !!t.endDate && t.endDate < todayIn(t.timezone ?? 'Asia/Seoul');
    } catch {
      return false;
    }
  };
  const view = (r: Row) => ({
    id: r.id,
    tripId: r.trip_id,
    bookingId: r.booking_id,
    name: r.name,
    mime: r.mime,
    size: r.size,
    createdAt: r.created_at,
  });

  // 파일 그대로 받기 (이 경로만 10MB까지)
  app.addContentTypeParser(
    [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/gif',
    ],
    { parseAs: 'buffer', bodyLimit: ATTACHMENT_MAX },
    (_req, body, done) => done(null, body),
  );

  app.get<{ Params: { tripId: string } }>(
    '/api/trips/:tripId/attachments',
    auth,
    async (req, reply) => {
      if (!roleIn(req.params.tripId, req.user!.userId))
        return reply.code(404).send({ error: 'not_found' });
      const rows = db
        .prepare('SELECT * FROM attachments WHERE trip_id = ? ORDER BY created_at')
        .all(req.params.tripId) as unknown as Row[];
      return { attachments: rows.map(view) };
    },
  );

  app.post<{ Params: { tripId: string; bookingId: string }; Body: Buffer }>(
    '/api/trips/:tripId/bookings/:bookingId/attachments',
    {
      ...auth,
      bodyLimit: ATTACHMENT_MAX,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { tripId, bookingId } = req.params;
      const role = roleIn(tripId, req.user!.userId);
      if (!role) return reply.code(404).send({ error: 'not_found' });
      if (role === 'viewer') return reply.code(403).send({ error: 'viewer' });
      if (tripEnded(tripId)) return reply.code(410).send({ error: 'trip_ended' });
      const mime = String(req.headers['content-type'] ?? '')
        .split(';')[0]!
        .trim();
      if (!ATTACHMENT_TYPES.test(mime) || !Buffer.isBuffer(req.body))
        return reply.code(415).send({ error: 'unsupported_type' });
      if (req.body.length === 0 || req.body.length > ATTACHMENT_MAX)
        return reply.code(413).send({ error: 'too_large' });
      const booking = db
        .prepare("SELECT 1 FROM records WHERE table_name = 'bookings' AND id = ? AND trip_id = ?")
        .get(bookingId, tripId);
      if (!booking) return reply.code(409).send({ error: 'booking_not_synced' });
      let name = 'file';
      try {
        name =
          decodeURIComponent(String(req.headers['x-file-name'] ?? 'file')).slice(0, 120) || 'file';
      } catch {
        // 이름이 깨져 있으면 기본 이름
      }
      const id = String(req.headers['x-attachment-id'] ?? '') || uuidv7();
      if (!safeId(id)) return reply.code(400).send({ error: 'bad_id' });
      writeFileSync(join(dir(), id), req.body);
      db.prepare(
        `INSERT INTO attachments (id, trip_id, booking_id, owner_user_id, name, mime, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      ).run(
        id,
        tripId,
        bookingId,
        req.user!.userId,
        name,
        mime,
        req.body.length,
        new Date().toISOString(),
      );
      const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as unknown as Row;
      return view(row);
    },
  );

  app.get<{ Params: { id: string } }>('/api/attachments/:id', auth, async (req, reply) => {
    if (!safeId(req.params.id)) return reply.code(404).send({ error: 'not_found' });
    const row = db
      .prepare('SELECT * FROM attachments WHERE id = ?')
      .get(req.params.id) as unknown as Row | undefined;
    if (!row || !roleIn(row.trip_id, req.user!.userId))
      return reply.code(404).send({ error: 'not_found' });
    const file = join(dir(), row.id);
    if (!existsSync(file)) return reply.code(404).send({ error: 'not_found' });
    reply.header('content-type', row.mime);
    reply.header('cache-control', 'private, no-store');
    reply.header('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`);
    return reply.send(createReadStream(file));
  });

  app.delete<{ Params: { id: string } }>('/api/attachments/:id', auth, async (req, reply) => {
    if (!safeId(req.params.id)) return reply.code(404).send({ error: 'not_found' });
    const row = db
      .prepare('SELECT * FROM attachments WHERE id = ?')
      .get(req.params.id) as unknown as Row | undefined;
    if (!row) return { ok: true };
    const role = roleIn(row.trip_id, req.user!.userId);
    if (!role) return reply.code(404).send({ error: 'not_found' });
    if (role === 'viewer') return reply.code(403).send({ error: 'viewer' });
    removeFiles(dir(), [row.id]);
    db.prepare('DELETE FROM attachments WHERE id = ?').run(row.id);
    return { ok: true };
  });
}
