import { runRestore } from '../ops/runBackup';

/**
 * 복구 (분기 1회 리허설 권장 — ops/README.md):
 *   pnpm restore <백업파일.tpbk> <새 DB 파일 경로>
 * 기존 DB는 덮어쓰지 않는다. 새 경로에 풀고 확인한 뒤, 서버를 멈추고 직접 바꿔 넣는다
 */
const [file, target] = process.argv.slice(2);
if (!file || !target) throw new Error('사용: pnpm restore <백업파일> <새 DB 파일>');
const { users, records } = runRestore(file, target, process.env.BACKUP_KEY ?? '');
console.log(`복구 확인 완료: 사용자 ${users}명, 기록 ${records}개 → ${target}`);
