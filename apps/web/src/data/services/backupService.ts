import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLE_NAMES,
  type BackupFile,
  type ParsedBackup,
} from '@trippocket/shared';
import { db, toDomain } from '../db';
import { LAST_BACKUP_KEY } from '../repositories/backupMeta';

/** 백업 만들기·복원 (docs/06 §3). 파일 형식 확인은 shared의 parseBackup */

/** 설정 표에서 백업하지 않는 것: 다시 받을 수 있는 캐시, 백업 시각 자체 */
const isCacheKey = (key: string) =>
  key.startsWith('holidays:') ||
  key.startsWith('weather:') ||
  key === 'fxCache' ||
  key === LAST_BACKUP_KEY;

const tables = () => [...BACKUP_TABLE_NAMES.map((t) => db[t]), db.settings];

export async function createBackup(): Promise<BackupFile> {
  const data: BackupFile['data'] = {};
  await db.transaction('r', tables(), async () => {
    for (const t of BACKUP_TABLE_NAMES) data[t] = (await db[t].toArray()).map((r) => toDomain(r));
    data.settings = (await db.settings.toArray()).filter((r) => !isCacheKey(r.key));
  });
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** 여행 1건만 (S-25 파일로 내보내기) — 받은 사람은 백업·복원의 "합치기"로 가져온다 */
export async function createTripBackup(tripId: string): Promise<BackupFile> {
  const file = await createBackup();
  const own = (rows: unknown[] | undefined) =>
    (rows ?? []).filter((r) => (r as { tripId?: string }).tripId === tripId);
  file.data = {
    trips: (file.data.trips ?? []).filter((t) => (t as { id: string }).id === tripId),
    items: own(file.data.items),
    bookings: own(file.data.bookings),
    checklistItems: own(file.data.checklistItems),
  };
  return file;
}

/** 파일 이름: trippocket-backup-2026-10-23.json */
export function backupFileName(file: BackupFile): string {
  return `trippocket-backup-${file.exportedAt.slice(0, 10)}.json`;
}

export { lastBackupAt, markBackedUp } from '../repositories/backupMeta';

export type RestoreMode = 'merge' | 'replace';

interface Table {
  clear(): Promise<void>;
  bulkGet(ids: string[]): Promise<({ updatedAt?: string } | undefined)[]>;
  bulkPut(rows: unknown[]): Promise<unknown>;
}

/**
 * 복원. 한 번의 트랜잭션 — 실패하면 아무것도 바뀌지 않는다.
 * - merge: 같은 id는 updatedAt이 더 최근인 쪽, 없는 건 추가
 * - replace: 지금 데이터를 지우고 백업으로 (캐시는 남김)
 * 들어온 행은 동기화 대상으로 표시 (dirty)
 */
export async function restoreBackup(
  parsed: Extract<ParsedBackup, { ok: true }>,
  mode: RestoreMode,
): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    for (const t of BACKUP_TABLE_NAMES) {
      const table = db[t] as unknown as Table;
      const rows = parsed.data[t];
      let put = rows;
      if (mode === 'replace') await table.clear();
      else {
        const existing = await table.bulkGet(rows.map((r) => r.id));
        put = rows.filter((r, i) => (r.updatedAt ?? '') > (existing[i]?.updatedAt ?? ''));
      }
      await table.bulkPut(put.map((r) => ({ ...r, dirty: 1 })));
    }
    if (mode === 'replace') {
      const keep = (await db.settings.toArray()).filter((r) => isCacheKey(r.key));
      await db.settings.clear();
      await db.settings.bulkPut(keep);
    }
    await db.settings.bulkPut(parsed.settings.filter((r) => !isCacheKey(r.key)));
  });
}
