import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { todayIn } from '@trippocket/shared';
import type { Db } from '../db/database';

/** 예약 문서 1개 상한 (사용자 결정 2026-10-25) */
export const ATTACHMENT_MAX = 10 * 1024 * 1024;
export const ATTACHMENT_TYPES = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf)$/;

/** 파일 저장 폴더: DATA_DIR/attachments (DB와 같은 곳, 웹 루트 밖) */
export function attachmentsDir(dataDir: string): string {
  const dir = join(dataDir, 'attachments');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 파일 id는 uuid만 (경로 조작 방지) */
export const safeId = (id: string) => /^[0-9a-f-]{36}$/.test(id);

export function removeFiles(dir: string, ids: readonly string[]): void {
  for (const id of ids) if (safeId(id)) rmSync(join(dir, id), { force: true });
}

/**
 * 끝난 여행의 문서는 서버에서 지운다 — 기기에 받아 둔 것만 남는다 (사용자 결정 2026-10-25).
 * 여행지 시간대로 마지막 날이 지났을 때. 반환: 지운 수
 */
export function purgeEndedTripFiles(db: Db, dir: string, now = new Date()): number {
  const rows = db
    .prepare(
      `SELECT a.id, r.data_json FROM attachments a
       LEFT JOIN records r ON r.table_name = 'trips' AND r.id = a.trip_id`,
    )
    .all() as { id: string; data_json: string | null }[];
  const ended = rows.filter((r) => {
    if (!r.data_json) return true; // 여행이 지워짐
    const t = JSON.parse(r.data_json) as {
      endDate?: string;
      timezone?: string;
      deletedAt?: string;
    };
    if (t.deletedAt) return true;
    let today: string;
    try {
      today = todayIn(t.timezone ?? 'Asia/Seoul', now);
    } catch {
      today = todayIn('Asia/Seoul', now);
    }
    return !!t.endDate && t.endDate < today;
  });
  const ids = ended.map((r) => r.id);
  if (ids.length === 0) return 0;
  removeFiles(dir, ids);
  const del = db.prepare('DELETE FROM attachments WHERE id = ?');
  for (const id of ids) del.run(id);
  return ids.length;
}
