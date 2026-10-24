import type { Db } from '../db/database';

const DAY = 86_400_000;

/**
 * 서버 DB 정리 (2026-10-25 리소스 점검): 시간이 지나 쓰지 않는 행을 지우고 SQLite를 가볍게.
 * - 만료된 로그인 세션, 1시간 지난 로그인 시작 기록(state), 만료된 AI 결과 저장본
 * - 사용량 기록은 13개월만 (관리자 화면은 이번 달·지난달만 봄)
 * - 지운 뒤 PRAGMA optimize + WAL 파일 비우기 (WAL이 DB보다 커지는 것 방지)
 * 동기화용 삭제 표시(records.deleted_at)는 오래 꺼져 있던 기기가 받아야 해서 지우지 않는다
 */
export function runMaintenance(db: Db, now = Date.now()): Record<string, number> {
  const iso = (ms: number) => new Date(ms).toISOString();
  const day = (ms: number) => iso(ms).slice(0, 10);
  const run = (sql: string, ...args: string[]) => Number(db.prepare(sql).run(...args).changes);
  const removed = {
    sessions: run(
      'DELETE FROM sessions WHERE expires_at < ? OR absolute_expires_at < ?',
      iso(now),
      iso(now),
    ),
    oauthStates: run('DELETE FROM oauth_states WHERE created_at < ?', iso(now - 3_600_000)),
    aiCache: run('DELETE FROM ai_cache WHERE expires_at < ?', iso(now)),
    apiUsage: run('DELETE FROM api_usage WHERE date < ?', day(now - 400 * DAY)),
    placesUsage: run('DELETE FROM places_usage WHERE date < ?', day(now - 400 * DAY)),
    aiUsage: run('DELETE FROM ai_usage WHERE date < ?', day(now - 400 * DAY)),
  };
  db.exec('PRAGMA optimize; PRAGMA wal_checkpoint(TRUNCATE);');
  return removed;
}

/** 시작할 때 한 번 + 6시간마다. 반환값으로 멈춤 */
export function scheduleMaintenance(db: Db, log: (msg: string) => void): () => void {
  const tick = () => {
    try {
      const r = runMaintenance(db);
      const total = Object.values(r).reduce((a, b) => a + b, 0);
      if (total) log(`DB 정리: ${JSON.stringify(r)}`);
    } catch (e) {
      log(`DB 정리 실패: ${String(e)}`);
    }
  };
  tick();
  const id = setInterval(tick, 6 * 3_600_000);
  id.unref();
  return () => clearInterval(id);
}
