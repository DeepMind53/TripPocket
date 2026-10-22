import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { backupName, decryptBackup, encryptBackup, pruneList } from './backup';

/**
 * 야간 백업: SQLite 온라인 백업(VACUUM INTO) → 압축·암호화 → 각 폴더에 저장 → 오래된 것 정리.
 * 한 폴더(예: 외장 디스크 빠짐)가 실패해도 다른 폴더에는 저장. 돌려줌: 저장한 파일 경로들
 */
export function runBackup(opts: { dataDir: string; key: string; dirs: string[]; now?: Date }): {
  saved: string[];
  failed: string[];
} {
  if (opts.key.length < 16) throw new Error('BACKUP_KEY(16자 이상)가 필요해요');
  if (opts.dirs.length === 0) throw new Error('BACKUP_DIRS가 필요해요');
  const now = opts.now ?? new Date();
  const snapshot = join(tmpdir(), `trippocket-snapshot-${process.pid}-${now.getTime()}.sqlite`);
  rmSync(snapshot, { force: true });
  const db = new DatabaseSync(join(opts.dataDir, 'trippocket.sqlite'), { readOnly: true });
  try {
    // 서버가 켜져 있어도 일관된 사본 (WAL 포함)
    db.prepare('VACUUM INTO ?').run(snapshot);
  } finally {
    db.close();
  }
  const encrypted = encryptBackup(readFileSync(snapshot), opts.key);
  unlinkSync(snapshot);

  const name = backupName(now);
  const saved: string[] = [];
  const failed: string[] = [];
  for (const dir of opts.dirs) {
    try {
      mkdirSync(dir, { recursive: true });
      const tmp = join(dir, `${name}.part`);
      writeFileSync(tmp, encrypted);
      renameSync(tmp, join(dir, name)); // 다 쓴 뒤에만 이름을 바꿔 반쪽 파일이 남지 않게
      for (const old of pruneList(readdirSync(dir), now)) unlinkSync(join(dir, old));
      saved.push(join(dir, name));
    } catch {
      failed.push(dir);
    }
  }
  return { saved, failed };
}

/**
 * 복구: 새 경로에 풀고 무결성 확인 (기존 DB는 덮어쓰지 않음).
 * 돌려줌: 사용자 수·기록 수 (리허설 확인용)
 */
export function runRestore(
  file: string,
  target: string,
  key: string,
): { users: number; records: number } {
  if (existsSync(target)) throw new Error(`이미 있는 파일이에요: ${target} (덮어쓰지 않음)`);
  writeFileSync(target, decryptBackup(readFileSync(file), key));
  const db = new DatabaseSync(target, { readOnly: true });
  try {
    const check = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (check.integrity_check !== 'ok')
      throw new Error(`무결성 검사 실패: ${check.integrity_check}`);
    const count = (t: string) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    return { users: count('users'), records: count('records') };
  } finally {
    db.close();
  }
}
