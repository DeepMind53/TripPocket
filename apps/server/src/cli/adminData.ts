/**
 * 서버 데이터 관리 — 이 PC(서버)에서만 실행된다 (사용자 결정 2026-10-25: 서버 데이터는 관리자만, 서버 PC에서만 지운다).
 * 웹·API로는 열지 않는다. DB 파일에 직접 붙으므로 서버 PC에 로그인한 사람만 쓸 수 있다.
 *
 *   cd apps\server
 *   pnpm admin:data list                          — 사용자·여행·문서·후기 수, 문서 용량
 *   pnpm admin:data purge-ended --yes             — 끝난 여행의 문서 지우기 (서버가 6시간마다 하는 것과 같음)
 *   pnpm admin:data delete-trip-files <tripId> --yes — 한 여행의 문서 모두 지우기
 *   pnpm admin:data delete-user <userId> --yes    — 계정과 그 사람의 서버 데이터 지우기 (후기는 User#N으로 남음)
 * 실행 전 작업 스케줄러에서 서버를 멈출 필요는 없다 (SQLite WAL — 동시에 써도 됨)
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config';
import { openDb } from '../db/database';
import { attachmentsDir, purgeEndedTripFiles, removeFiles } from '../services/attachments';

const [cmd, arg, ...rest] = process.argv.slice(2);
const yes = [arg, ...rest].includes('--yes');
const config = loadConfig();
const db = openDb(config.DATA_DIR);
const dir = attachmentsDir(config.DATA_DIR);
const count = (sql: string, ...a: string[]) =>
  Number((db.prepare(sql).get(...a) as { n: number }).n);
const needYes = () => {
  if (!yes) {
    console.log('지우려면 끝에 --yes 를 붙이세요 (되돌릴 수 없음)');
    process.exit(1);
  }
};

switch (cmd) {
  case 'list': {
    const bytes = readdirSync(dir).reduce((s, f) => s + statSync(join(dir, f)).size, 0);
    console.log(`사용자 ${count('SELECT COUNT(*) n FROM users')}명`);
    console.log(
      `여행 ${count("SELECT COUNT(*) n FROM records WHERE table_name = 'trips' AND deleted_at IS NULL")}개`,
    );
    console.log(
      `문서 ${count('SELECT COUNT(*) n FROM attachments')}개 · ${(bytes / 1024 / 1024).toFixed(1)}MB`,
    );
    console.log(`후기 ${count('SELECT COUNT(*) n FROM reviews')}개`);
    break;
  }
  case 'purge-ended':
    needYes();
    console.log(`끝난 여행 문서 ${purgeEndedTripFiles(db, dir)}개를 지웠어요`);
    break;
  case 'delete-trip-files': {
    if (!arg || arg === '--yes') throw new Error('여행 id를 넣어 주세요');
    needYes();
    const ids = (
      db.prepare('SELECT id FROM attachments WHERE trip_id = ?').all(arg) as { id: string }[]
    ).map((r) => r.id);
    removeFiles(dir, ids);
    db.prepare('DELETE FROM attachments WHERE trip_id = ?').run(arg);
    console.log(`문서 ${ids.length}개를 지웠어요`);
    break;
  }
  case 'delete-user': {
    if (!arg || arg === '--yes') throw new Error('사용자 id를 넣어 주세요');
    needYes();
    const files = (
      db.prepare('SELECT id FROM attachments WHERE owner_user_id = ?').all(arg) as { id: string }[]
    ).map((r) => r.id);
    db.exec('BEGIN');
    try {
      removeFiles(dir, files);
      db.prepare('DELETE FROM attachments WHERE owner_user_id = ?').run(arg);
      db.prepare('DELETE FROM records WHERE owner_user_id = ?').run(arg);
      db.prepare('DELETE FROM users WHERE id = ?').run(arg);
      db.prepare(
        'INSERT INTO audit_log (user_id, action, target, created_at) VALUES (NULL, ?, ?, ?)',
      ).run('admin_delete_user', arg, new Date().toISOString());
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    console.log('계정과 서버 데이터를 지웠어요');
    break;
  }
  default:
    console.log(
      '명령: list | purge-ended --yes | delete-trip-files <tripId> --yes | delete-user <userId> --yes',
    );
}
db.close();
