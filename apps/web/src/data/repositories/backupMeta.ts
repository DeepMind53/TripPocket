import { db } from '../db';

/** 마지막 백업 시각 (홈 백업 알림이 읽는다 — 백업 형식·스키마를 첫 화면에 싣지 않으려고 따로 둠) */
export const LAST_BACKUP_KEY = 'lastBackupAt';

export async function lastBackupAt(): Promise<string | null> {
  const row = await db.settings.get(LAST_BACKUP_KEY);
  return typeof row?.value === 'string' ? row.value : null;
}

export async function markBackedUp(): Promise<void> {
  await db.settings.put({ key: LAST_BACKUP_KEY, value: new Date().toISOString() });
}
