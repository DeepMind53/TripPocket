/**
 * 서버 데이터 관리 — 이 PC(서버)에서만 실행된다 (사용자 결정 2026-10-25: 서버 데이터는 관리자만, 서버 PC에서만 지운다).
 * 웹·API로는 열지 않는다. DB 파일에 직접 붙으므로 서버 PC에 로그인한 사람만 쓸 수 있다.
 *
 *   cd apps\server
 *   pnpm admin:data list                          — 사용자·여행·문서·후기 수, 문서 용량
 *   pnpm admin:data purge-ended --yes             — 끝난 여행의 문서 지우기 (서버가 6시간마다 하는 것과 같음)
 *   pnpm admin:data delete-trip-files <tripId> --yes — 한 여행의 문서 모두 지우기
 *   pnpm admin:data delete-user <userId> --yes    — 계정과 그 사람의 서버 데이터 지우기 (후기는 User#N으로 남음)
 *   pnpm admin:data delete-sample [--yes]          — 실험실 샘플 테스트로 만든 [샘플] 여행·저장 장소 지우기 (--yes 없으면 목록만)
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
  case 'delete-sample': {
    // 실험실 "샘플 테스트"로 만든 [샘플] 여행(과 그 일정·예약·준비물)·[샘플] 저장 장소를 지운다 (2026-10-27).
    // 기기들이 다음 동기화 때 지우도록 삭제 표시 + 새 순번(rev)으로 남긴다. --yes 없이 부르면 목록만
    const trips = db
      .prepare(
        // 이미 지운 샘플 여행도 — 안의 일정·예약이 남아 있을 수 있다
        "SELECT id, owner_user_id, json_extract(data_json, '$.title') AS title FROM records WHERE table_name = 'trips' AND json_extract(data_json, '$.title') LIKE '[샘플]%'",
      )
      .all() as { id: string; owner_user_id: string; title: string }[];
    const saved = db
      .prepare(
        "SELECT id FROM records WHERE table_name = 'savedPlaces' AND deleted_at IS NULL AND json_extract(data_json, '$.memo') = '[샘플]'",
      )
      .all() as { id: string }[];
    const left = (id: string) =>
      Number(
        (
          db
            .prepare('SELECT COUNT(*) n FROM records WHERE trip_id = ? AND deleted_at IS NULL')
            .get(id) as { n: number }
        ).n,
      );
    for (const t of trips) console.log(`여행: ${t.title} (${t.id}) — 남은 행 ${left(t.id)}개`);
    console.log(`저장 장소: ${saved.length}곳`);
    if (trips.every((t) => left(t.id) === 0) && saved.length === 0) {
      console.log('지울 샘플이 없어요');
      break;
    }
    needYes();
    const now = new Date().toISOString();
    const rev = () => {
      db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'rev'").run();
      return (
        db.prepare("SELECT value FROM counters WHERE name = 'rev'").get() as { value: number }
      ).value;
    };
    const mark = db.prepare(
      "UPDATE records SET deleted_at = ?, updated_at = ?, rev = ?, data_json = json_set(data_json, '$.deletedAt', ?, '$.updatedAt', ?) WHERE table_name = ? AND id = ?",
    );
    let n = 0;
    db.exec('BEGIN');
    try {
      for (const t of trips) {
        const children = db
          .prepare('SELECT table_name, id FROM records WHERE trip_id = ? AND deleted_at IS NULL')
          .all(t.id) as { table_name: string; id: string }[];
        for (const c of children) {
          mark.run(now, now, rev(), now, now, c.table_name, c.id);
          n++;
        }
      }
      for (const sp of saved) {
        mark.run(now, now, rev(), now, now, 'savedPlaces', sp.id);
        n++;
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    console.log(`샘플 ${n}건을 지웠어요 (기기는 다음 동기화 때 사라져요)`);
    break;
  }
  default:
    console.log(
      '명령: list | purge-ended --yes | delete-trip-files <tripId> --yes | delete-user <userId> --yes | delete-sample [--yes]',
    );
}
db.close();
