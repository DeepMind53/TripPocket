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
