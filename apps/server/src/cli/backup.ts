import { runBackup } from '../ops/runBackup';

/**
 * 야간 백업 (작업 스케줄러가 매일 03:00 실행 — ops/install.ps1)
 * 환경 변수: DATA_DIR, BACKUP_KEY(16자 이상), BACKUP_DIRS(;로 구분 — 예: E:\TripPocketBackup;C:\Users\나\OneDrive\TripPocket)
 */
const { saved, failed } = runBackup({
  dataDir: process.env.DATA_DIR ?? './data',
  key: process.env.BACKUP_KEY ?? '',
  dirs: (process.env.BACKUP_DIRS ?? '')
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean),
});
for (const f of saved) console.log(`백업 저장: ${f}`);
for (const d of failed) console.error(`백업 실패: ${d}`);
if (saved.length === 0) process.exit(1);
