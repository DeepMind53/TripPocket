import {
  parseRecord,
  SAVED_PLACES_MAX,
  TRIP_SCOPED,
  USER_SCOPED,
  type PullResult,
  type PushResult,
  type SyncTable,
} from '@trippocket/shared';
import type { Db } from '../db/database';

type Role = 'owner' | 'editor' | 'viewer';

interface StoredRow {
  trip_id: string | null;
  owner_user_id: string;
  data_json: string;
  rev: number;
}

/**
 * 동기화 저장소 — 모든 쿼리에 사용자·여행 멤버십 조건을 강제한다 (docs/09 §5, IDOR 방지).
 * 클라이언트가 보낸 tripId·소유자를 그대로 믿지 않는다.
 */
export function syncRepo(db: Db) {
  const roleOf = (userId: string, tripId: string): Role | null => {
    const r = db
      .prepare('SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?')
      .get(tripId, userId) as { role: Role } | undefined;
    return r?.role ?? null;
  };
  const canEdit = (role: Role | null) => role === 'owner' || role === 'editor';
  const getRow = (table: SyncTable, id: string) =>
    db
      .prepare(
        'SELECT trip_id, owner_user_id, data_json, rev FROM records WHERE table_name = ? AND id = ?',
      )
      .get(table, id) as StoredRow | undefined;
  const nextRev = () => {
    db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'rev'").run();
    return (db.prepare("SELECT value FROM counters WHERE name = 'rev'").get() as { value: number })
      .value;
  };

  /** 이 사용자가 이 행을 쓸 수 있나. 쓸 수 있으면 저장할 trip_id */
  function authorize(
    userId: string,
    table: SyncTable,
    record: { id: string; tripId?: string | undefined; deletedAt?: string | undefined },
    existing: StoredRow | undefined,
  ): { ok: true; tripId: string | null } | { ok: false } {
    if (USER_SCOPED.includes(table)) {
      if (existing && existing.owner_user_id !== userId) return { ok: false };
      return { ok: true, tripId: null };
    }
    if (table === 'trips') {
      if (!existing) {
        // 새 여행: 이 id가 다른 사람 여행 멤버십으로 이미 쓰이면 거부 (가로채기 방지)
        const taken = db.prepare('SELECT 1 FROM trip_members WHERE trip_id = ?').get(record.id);
        return taken ? { ok: false } : { ok: true, tripId: record.id };
      }
      const role = roleOf(userId, record.id);
      // 여행 삭제는 소유자만
      if (record.deletedAt && role !== 'owner') return { ok: false };
      return canEdit(role) ? { ok: true, tripId: record.id } : { ok: false };
    }
    if (table === 'checklistItems') {
      // 준비물·할 일·필수 항목은 사람마다 따로 (2026-10-27): 여행 멤버면(보기 전용도) 자기 것만 쓴다
      if (!record.tripId || !roleOf(userId, record.tripId)) return { ok: false };
      if (existing && existing.owner_user_id !== userId) return { ok: false };
      return { ok: true, tripId: record.tripId };
    }
    if (TRIP_SCOPED.includes(table)) {
      if (!record.tripId || !canEdit(roleOf(userId, record.tripId))) return { ok: false };
      // 다른 여행으로 옮기는 경우 원래 여행에도 권한이 있어야
      if (
        existing?.trip_id &&
        existing.trip_id !== record.tripId &&
        !canEdit(roleOf(userId, existing.trip_id))
      )
        return { ok: false };
      return { ok: true, tripId: record.tripId };
    }
    return { ok: false };
  }

  function push(
    userId: string,
    changes: { table: SyncTable; record: Record<string, unknown>; baseRev: number | null }[],
  ): PushResult {
    const result: PushResult = { applied: [], rejected: [] };
    db.exec('BEGIN');
    try {
      for (const c of changes) {
        const id = typeof c.record.id === 'string' ? c.record.id : '';
        const record = parseRecord(c.table, c.record);
        if (!record) {
          result.rejected.push({ table: c.table, id, reason: 'invalid' });
          continue;
        }
        const existing = getRow(c.table, record.id);
        const auth = authorize(userId, c.table, record, existing);
        if (!auth.ok) {
          // 없는 것과 같은 응답 — 다른 사람 데이터가 있는지 알려 주지 않는다
          result.rejected.push({ table: c.table, id: record.id, reason: 'forbidden' });
          continue;
        }
        // 저장한 장소는 한 사람 200곳까지 (기기도 막지만, 고친 앱·여러 기기에서 넘지 않게)
        if (c.table === 'savedPlaces' && !existing && !record.deletedAt) {
          const { n } = db
            .prepare(
              "SELECT COUNT(*) AS n FROM records WHERE table_name = 'savedPlaces' AND owner_user_id = ? AND deleted_at IS NULL",
            )
            .get(userId) as { n: number };
          if (n >= SAVED_PLACES_MAX) {
            result.rejected.push({ table: c.table, id: record.id, reason: 'limit' });
            continue;
          }
        }
        // 충돌: 기기가 본 뒤에 서버 쪽이 바뀌었으면, 진 쪽(서버 기존 값)을 보관하고 나중 도착분 채택
        if (existing && c.baseRev !== existing.rev) {
          db.prepare(
            'INSERT INTO conflicts (table_name, record_id, user_id, losing_data_json, created_at) VALUES (?, ?, ?, ?, ?)',
          ).run(c.table, record.id, userId, existing.data_json, new Date().toISOString());
        }
        const rev = nextRev();
        const { rev: _ignored, ...data } = record;
        db.prepare(
          `INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, deleted_at, rev)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (table_name, id) DO UPDATE SET
             trip_id = excluded.trip_id, data_json = excluded.data_json,
             updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, rev = excluded.rev`,
        ).run(
          c.table,
          record.id,
          auth.tripId,
          existing?.owner_user_id ?? userId,
          JSON.stringify(data),
          record.updatedAt,
          record.deletedAt ?? null,
          rev,
        );
        if (c.table === 'trips' && !existing) {
          db.prepare(
            "INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
          ).run(record.id, userId, new Date().toISOString());
        }
        result.applied.push({ table: c.table, id: record.id, rev });
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return result;
  }

  /**
   * 내가 볼 수 있는 것만: 내 여행(멤버)과 그 하위 행, 내 개인 행.
   * 준비 목록(checklistItems)은 내 것 + 일행이 한 번이라도 공유한 준비물(sharedAt — 공유를 끈 것도 숨기라고 내려준다)
   */
  function pull(userId: string, since: number, limit: number): PullResult {
    const rows = db
      .prepare(
        `SELECT table_name, data_json, rev, owner_user_id FROM records
         WHERE rev > ? AND (
           (trip_id IS NOT NULL AND trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))
           OR (trip_id IS NULL AND owner_user_id = ?)
         )
         AND NOT (
           table_name = 'checklistItems' AND owner_user_id != ?
           AND json_extract(data_json, '$.sharedAt') IS NULL
         )
         ORDER BY rev LIMIT ?`,
      )
      .all(since, userId, userId, userId, limit + 1) as {
      table_name: SyncTable;
      data_json: string;
      rev: number;
      owner_user_id: string | null;
    }[];
    const page = rows.slice(0, limit);
    // 내가 멤버인 여행: 내 역할 + 멤버 수
    const mine = db
      .prepare(
        `SELECT m.trip_id, m.role, (SELECT COUNT(*) FROM trip_members x WHERE x.trip_id = m.trip_id) AS n
         FROM trip_members m WHERE m.user_id = ?`,
      )
      .all(userId) as { trip_id: string; role: Role; n: number }[];
    return {
      changes: page.map((r) => ({
        table: r.table_name,
        record: {
          ...(JSON.parse(r.data_json) as { id: string; updatedAt: string }),
          // 준비 목록: 누구 것인지 (기기에서 내 것·일행 공유를 나눈다)
          ...(r.table_name === 'checklistItems' && r.owner_user_id
            ? { ownerId: r.owner_user_id }
            : {}),
          rev: r.rev,
        },
        rev: r.rev,
      })),
      nextRev: page.at(-1)?.rev ?? since,
      hasMore: rows.length > limit,
      roles: Object.fromEntries(mine.map((m) => [m.trip_id, m.role])),
      memberCounts: Object.fromEntries(mine.map((m) => [m.trip_id, m.n])),
    };
  }

  return { push, pull };
}
