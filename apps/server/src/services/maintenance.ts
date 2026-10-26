import type { Db } from '../db/database';
import { attachmentsDir, purgeEndedTripFiles } from './attachments';

const DAY = 86_400_000;

/**
 * 서버 DB 정리 (2026-10-25 리소스 점검): 시간이 지나 쓰지 않는 행을 지우고 SQLite를 가볍게.
 * - 만료된 로그인 세션, 1시간 지난 로그인 시작 기록(state), 만료된 AI 결과 저장본
 * - 사용량 기록은 13개월만 (관리자 화면은 이번 달·지난달만 봄)
 * - 지운 뒤 PRAGMA optimize + WAL 파일 비우기 (WAL이 DB보다 커지는 것 방지)
 * - 지운 지 7일(앱의 복원 기간)이 지난 기록은 내용을 비우고 삭제 표시만 남긴다 (사용자 결정 2026-10-27).
 *   삭제 표시(records.deleted_at)는 오래 꺼져 있던 기기가 받아야 해서 행은 남긴다. rev는 그대로(이미 받은 기기에 다시 보내지 않음)
 */
export const PURGE_DELETED_DAYS = 7;

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
    deletedContent: run(
      `UPDATE records SET data_json = json_object('id', id, 'updatedAt', updated_at, 'deletedAt', deleted_at, 'purged', 1)
       WHERE deleted_at IS NOT NULL AND deleted_at < ? AND json_extract(data_json, '$.purged') IS NULL`,
      iso(now - PURGE_DELETED_DAYS * DAY),
    ),
  };
  db.exec('PRAGMA optimize; PRAGMA wal_checkpoint(TRUNCATE);');
  return removed;
}

/** 시작할 때 한 번 + 6시간마다. 반환값으로 멈춤 */
export function scheduleMaintenance(
  db: Db,
  log: (msg: string) => void,
  dataDir?: string,
): () => void {
  const tick = () => {
    try {
      const r = runMaintenance(db);
      // 끝난 여행의 문서는 서버에서 지운다 — 기기에만 남음 (docs/20 G2)
      if (dataDir) r.endedTripFiles = purgeEndedTripFiles(db, attachmentsDir(dataDir));
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
