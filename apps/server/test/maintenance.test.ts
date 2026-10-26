import { openDb } from '../src/db/database';
import { runMaintenance } from '../src/services/maintenance';

it('DB 정리: 만료 세션·지난 로그인 state·만료 AI 저장본·13개월 넘은 사용량만 지운다', () => {
  const db = openDb(':memory:');
  const now = Date.parse('2026-10-25T00:00:00Z');
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u', 'u', 'x')").run();
  const session = (id: string, exp: string) =>
    db
      .prepare(
        "INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at, absolute_expires_at) VALUES (?, 'u', 'x', 'x', ?, '2027-01-01T00:00:00Z')",
      )
      .run(id, exp);
  session('old', '2026-10-01T00:00:00Z');
  session('live', '2026-11-01T00:00:00Z');
  db.prepare(
    "INSERT INTO api_usage (api, date, count) VALUES ('groq', '2025-01-01', 1), ('groq', '2026-10-01', 1)",
  ).run();
  const r = runMaintenance(db, now);
  expect(r).toMatchObject({ sessions: 1, apiUsage: 1 });
  expect(db.prepare('SELECT id_hash FROM sessions').all()).toEqual([{ id_hash: 'live' }]);
  expect(db.prepare('SELECT date FROM api_usage').all()).toEqual([{ date: '2026-10-01' }]);
  db.close();
});

it('지운 지 7일 지난 기록은 내용을 비우고 삭제 표시만 남긴다', () => {
  const db = openDb(':memory:');
  const now = Date.parse('2026-10-27T00:00:00Z');
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u', 'u', 'x')").run();
  const put = (id: string, deletedAt: string | null) =>
    db
      .prepare(
        "INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, deleted_at, rev) VALUES ('items', ?, NULL, 'u', ?, 'x', ?, 1)",
      )
      .run(id, JSON.stringify({ id, title: '비밀 일정', memo: '메모' }), deletedAt);
  put('old', '2026-10-19T00:00:00Z');
  put('recent', '2026-10-25T00:00:00Z');
  put('live', null);
  expect(runMaintenance(db, now)).toMatchObject({ deletedContent: 1 });
  const data = (id: string) =>
    JSON.parse(
      (db.prepare('SELECT data_json FROM records WHERE id = ?').get(id) as { data_json: string })
        .data_json,
    ) as Record<string, unknown>;
  expect(data('old')).toEqual({
    id: 'old',
    updatedAt: 'x',
    deletedAt: '2026-10-19T00:00:00Z',
    purged: 1,
  });
  expect(data('recent').title).toBe('비밀 일정');
  expect(data('live').title).toBe('비밀 일정');
  // 두 번째는 이미 비운 것이라 0
  expect(runMaintenance(db, now)).toMatchObject({ deletedContent: 0 });
  db.close();
});
