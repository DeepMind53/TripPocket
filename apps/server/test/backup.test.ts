import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db/database';
import { decryptBackup, encryptBackup, pruneList } from '../src/ops/backup';
import { runBackup, runRestore } from '../src/ops/runBackup';

describe('서버 백업 암호화', () => {
  it('같은 키로만 풀린다, 내용이 바뀌면 거부', () => {
    const data = Buffer.from('SQLite format 3\u0000 여행 데이터'.repeat(100));
    const enc = encryptBackup(data, 'correct horse battery');
    expect(enc.includes(Buffer.from('여행 데이터'))).toBe(false);
    expect(decryptBackup(enc, 'correct horse battery')).toEqual(data);
    expect(() => decryptBackup(enc, 'wrong passphrase!!')).toThrow();
    const tampered = Buffer.from(enc);
    tampered[tampered.length - 1]! ^= 1;
    expect(() => decryptBackup(tampered, 'correct horse battery')).toThrow();
  });

  it('보관: 최근 7일 하루 1개, 그 전 주 1개, 그 전 달 1개', () => {
    const now = new Date('2026-10-23T03:00:00Z');
    const names: string[] = [];
    for (let d = 0; d < 300; d++) {
      const t = new Date(now.getTime() - d * 86_400_000);
      names.push(`trippocket-${t.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.tpbk`);
    }
    names.push('other-file.txt');
    const drop = new Set(pruneList(names, now));
    const kept = names.filter((n) => n.endsWith('.tpbk') && !drop.has(n));
    expect(kept.length).toBeGreaterThanOrEqual(7 + 4);
    expect(kept.length).toBeLessThanOrEqual(7 + 5 + 7);
    expect(drop.has('other-file.txt')).toBe(false); // 모르는 파일은 건드리지 않음
    expect(kept).toContain(names[0]); // 오늘 것은 남음
  });
});

describe('복구 리허설', () => {
  it('서버 DB → 야간 백업(두 곳) → 새 경로에 복구 → 무결성·내용 확인, 한 곳이 실패해도 다른 곳엔 저장', () => {
    const work = mkdtempSync(join(tmpdir(), 'tp-ops-'));
    try {
      const dataDir = join(work, 'data');
      const db = openDb(dataDir);
      db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', '나', 'x')").run();
      db.prepare(
        "INSERT INTO records (table_name, id, owner_user_id, data_json, updated_at, rev) VALUES ('trips', 't1', 'u1', '{}', 'x', 1)",
      ).run();
      // 서버가 켜진 상태(연결 열림)에서 백업
      const blocked = join(work, 'not-a-dir');
      writeFileSync(blocked, 'file'); // 폴더 자리에 파일 → 이 곳은 실패
      const { saved, failed } = runBackup({
        dataDir,
        key: 'k'.repeat(20),
        dirs: [join(work, 'disk'), blocked, join(work, 'onedrive')],
      });
      db.close();
      expect(saved).toHaveLength(2);
      expect(failed).toEqual([blocked]);
      expect(readdirSync(join(work, 'disk')).every((f) => f.endsWith('.tpbk'))).toBe(true);

      // 아직 없는 폴더에도 풀 수 있다 (복구 리허설)
      const restored = join(work, 'rehearsal', 'restored.sqlite');
      expect(runRestore(saved[0]!, restored, 'k'.repeat(20))).toEqual({ users: 1, records: 1 });
      expect(() => runRestore(saved[0]!, restored, 'k'.repeat(20))).toThrow(/덮어쓰지 않음/);
      expect(() => runRestore(saved[1]!, join(work, 'x.sqlite'), 'wrong-key-wrong-key')).toThrow();
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
