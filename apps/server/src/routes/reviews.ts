import type { FastifyInstance } from 'fastify';
import {
  DAILY_POINT_REVIEWS,
  maskedName,
  REVIEW_POINTS,
  ReviewInputSchema,
  summarizeReviews,
  todayIn,
  uuidv7,
  type ReviewView,
} from '@trippocket/shared';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';

interface ReviewRow {
  id: string;
  user_id: string | null;
  author_no: number;
  trip_id: string;
  item_id: string;
  place_key: string | null;
  place_name: string;
  kind: string;
  ratings_json: string;
  note: string | null;
  visited_on: string | null;
  created_at: string;
  updated_at: string;
  nickname: string | null;
  hide_nickname: number | null;
  public_no: number | null;
}

const SELECT = `SELECT r.*, u.nickname, u.hide_nickname, u.public_no
  FROM reviews r LEFT JOIN users u ON u.id = r.user_id`;

/** 이름: 닉네임, 가리기를 켰거나 탈퇴했으면 User#N */
function view(r: ReviewRow, me: string): ReviewView {
  const author =
    r.user_id && r.nickname && !r.hide_nickname
      ? r.nickname
      : maskedName(r.public_no ?? r.author_no);
  return {
    id: r.id,
    author,
    mine: r.user_id === me,
    kind: r.kind as ReviewView['kind'],
    placeKey: r.place_key,
    placeName: r.place_name,
    ratings: JSON.parse(r.ratings_json) as ReviewView['ratings'],
    ...(r.note ? { note: r.note } : {}),
    visitedOn: r.visited_on,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * 후기·포인트 (docs/17). 모두 로그인 필요.
 * - 장소에 연결된 후기는 로그인한 모든 사람이 본다, 연결 안 된 후기는 그 여행 멤버만
 * - 쓰기는 여행 소유자·편집자만 (보기 전용 공유는 불가 — 사용자 결정 2026-10-25), 다녀온 날 이후만
 * - 포인트는 서버만 계산: 장소에 연결된 후기 1곳당 100P, 같은 장소는 한 번, 하루 10건까지
 */
export function reviewRoutes(app: FastifyInstance, db: Db): void {
  const auth = { preHandler: requireUser(db) };
  const roleIn = (tripId: string, userId: string) =>
    (
      db
        .prepare('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?')
        .get(tripId, userId) as { role: string } | undefined
    )?.role;
  const balance = (userId: string) =>
    Number(
      (
        db
          .prepare('SELECT COALESCE(SUM(delta), 0) AS n FROM point_ledger WHERE user_id = ?')
          .get(userId) as { n: number }
      ).n,
    );

  // 그 일정의 후기: 같은 장소(공개) + 이 일정에 붙은 후기(연결 전, 여행 멤버만) + 내 후기
  app.get<{ Querystring: { trip?: string; item?: string; place?: string } }>(
    '/api/reviews',
    { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const me = req.user!.userId;
      const { trip, item, place } = req.query;
      if (!trip || !item) return reply.code(400).send({ error: 'bad_request' });
      if (!roleIn(trip, me)) return reply.code(404).send({ error: 'not_found' });
      const rows = db
        .prepare(
          `${SELECT} WHERE r.hidden = 0 AND ((r.place_key IS NOT NULL AND r.place_key = ?)
             OR (r.trip_id = ? AND r.item_id = ?))
           ORDER BY r.created_at DESC LIMIT 50`,
        )
        .all(place ?? null, trip, item) as unknown as ReviewRow[];
      const list = rows.map((r) => view(r, me));
      const mine = rows.find((r) => r.user_id === me && r.item_id === item);
      return {
        reviews: list,
        summary: summarizeReviews(list),
        mine: mine ? view(mine, me) : null,
      };
    },
  );

  app.get('/api/reviews/mine', auth, async (req) => {
    const me = req.user!.userId;
    const rows = db
      .prepare(`${SELECT} WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 200`)
      .all(me) as unknown as ReviewRow[];
    return { reviews: rows.map((r) => ({ ...view(r, me), tripId: r.trip_id, itemId: r.item_id })) };
  });

  app.put<{ Body: unknown }>(
    '/api/reviews',
    { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const me = req.user!.userId;
      const parsed = ReviewInputSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_request' });
      const input = parsed.data;
      const role = roleIn(input.tripId, me);
      if (!role) return reply.code(404).send({ error: 'not_found' });
      if (role === 'viewer') return reply.code(403).send({ error: 'viewer' });

      // 일정이 서버에 있어야 하고(동기화된 것), 날짜가 지났어야 한다
      const itemRow = db
        .prepare(
          "SELECT data_json FROM records WHERE table_name = 'items' AND id = ? AND trip_id = ? AND deleted_at IS NULL",
        )
        .get(input.itemId, input.tripId) as { data_json: string } | undefined;
      if (!itemRow) return reply.code(409).send({ error: 'item_not_synced' });
      const date = (JSON.parse(itemRow.data_json) as { date?: string | null }).date ?? null;
      const tripRow = db
        .prepare("SELECT data_json FROM records WHERE table_name = 'trips' AND id = ?")
        .get(input.tripId) as { data_json: string } | undefined;
      const tz = tripRow
        ? ((JSON.parse(tripRow.data_json) as { timezone?: string }).timezone ?? 'Asia/Seoul')
        : 'Asia/Seoul';
      let today: string;
      try {
        today = todayIn(tz);
      } catch {
        today = todayIn('Asia/Seoul');
      }
      if (!date || date > today) return reply.code(422).send({ error: 'not_visited' });

      const now = new Date().toISOString();
      const user = db.prepare('SELECT public_no FROM users WHERE id = ?').get(me) as {
        public_no: number;
      };
      const existing = db
        .prepare('SELECT id, created_at FROM reviews WHERE user_id = ? AND item_id = ?')
        .get(me, input.itemId) as { id: string; created_at: string } | undefined;
      const id = existing?.id ?? uuidv7();
      let awarded = 0;
      db.exec('BEGIN');
      try {
        db.prepare(
          `INSERT INTO reviews (id, user_id, author_no, trip_id, item_id, place_key, place_name, kind,
             ratings_json, note, visited_on, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET place_key = excluded.place_key, place_name = excluded.place_name,
             kind = excluded.kind, ratings_json = excluded.ratings_json, note = excluded.note,
             visited_on = excluded.visited_on, updated_at = excluded.updated_at`,
        ).run(
          id,
          me,
          user.public_no,
          input.tripId,
          input.itemId,
          input.placeKey,
          input.placeName,
          input.kind,
          JSON.stringify(input.ratings),
          input.note?.trim() || null,
          date,
          existing?.created_at ?? now,
          now,
        );
        // 포인트: 장소에 연결됐고, 이 장소로 받은 포인트가 없고(지웠으면 다시 가능), 오늘 10건 미만
        if (input.placeKey) {
          const got = Number(
            (
              db
                .prepare(
                  'SELECT COALESCE(SUM(delta), 0) AS n FROM point_ledger WHERE user_id = ? AND place_key = ?',
                )
                .get(me, input.placeKey) as { n: number }
            ).n,
          );
          const todayCount = Number(
            (
              db
                .prepare(
                  "SELECT COUNT(*) AS n FROM point_ledger WHERE user_id = ? AND reason = 'review' AND created_at >= ?",
                )
                .get(me, now.slice(0, 10)) as { n: number }
            ).n,
          );
          if (got <= 0 && todayCount < DAILY_POINT_REVIEWS) {
            db.prepare(
              `INSERT INTO point_ledger (user_id, delta, reason, review_id, place_key, place_name, created_at)
               VALUES (?, ?, 'review', ?, ?, ?, ?)`,
            ).run(me, REVIEW_POINTS, id, input.placeKey, input.placeName, now);
            awarded = REVIEW_POINTS;
          }
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      const row = db.prepare(`${SELECT} WHERE r.id = ?`).get(id) as unknown as ReviewRow;
      return { review: view(row, me), pointsAwarded: awarded, balance: balance(me) };
    },
  );

  // 내 후기 지우기 — 그 후기로 받은 포인트는 회수
  app.delete<{ Params: { id: string } }>(
    '/api/reviews/:id',
    { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const me = req.user!.userId;
      const r = db
        .prepare('SELECT id, place_key, place_name FROM reviews WHERE id = ? AND user_id = ?')
        .get(req.params.id, me) as
        { id: string; place_key: string | null; place_name: string } | undefined;
      if (!r) return reply.code(404).send({ error: 'not_found' });
      revoke(db, me, r, 'review_deleted');
      db.prepare('DELETE FROM reviews WHERE id = ?').run(r.id);
      return { ok: true, balance: balance(me) };
    },
  );

  app.get('/api/me/points', auth, async (req, reply) => {
    reply.header('cache-control', 'no-store');
    const me = req.user!.userId;
    const history = db
      .prepare(
        'SELECT delta, reason, place_name, created_at FROM point_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 50',
      )
      .all(me) as {
      delta: number;
      reason: string;
      place_name: string | null;
      created_at: string;
    }[];
    return {
      balance: balance(me),
      history: history.map((h) => ({
        delta: h.delta,
        reason: h.reason,
        placeName: h.place_name,
        createdAt: h.created_at,
      })),
    };
  });
}

/** 그 후기로 받은 포인트 회수 (지움·관리자 숨김) */
export function revoke(
  db: Db,
  userId: string,
  r: { id: string; place_key: string | null; place_name: string },
  reason: 'review_deleted' | 'admin_hidden',
): void {
  if (!r.place_key) return;
  const got = Number(
    (
      db
        .prepare(
          'SELECT COALESCE(SUM(delta), 0) AS n FROM point_ledger WHERE user_id = ? AND place_key = ?',
        )
        .get(userId, r.place_key) as { n: number }
    ).n,
  );
  if (got > 0)
    db.prepare(
      `INSERT INTO point_ledger (user_id, delta, reason, review_id, place_key, place_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(userId, -got, reason, r.id, r.place_key, r.place_name, new Date().toISOString());
}
