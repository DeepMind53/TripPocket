import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { addDays, todayIn } from '@trippocket/shared';
import type { Db } from '../db/database';

/** 예약 문서 1개 상한 (사용자 결정 2026-10-25) */
export const ATTACHMENT_MAX = 10 * 1024 * 1024;
/**
 * 서버에 동시에 올려 둘 수 있는 양 (사용자 결정 2026-11-04): 여행 하나 250MB, 계정 하나 500MB.
 * 개수 제한은 없다. 기기에 저장하는 것은 제한 없음. 끝난 여행 문서가 서버에서 지워지면 그만큼 다시 쓸 수 있다
 */
export const TRIP_QUOTA = 250 * 1024 * 1024;
export const USER_QUOTA = 500 * 1024 * 1024;
/** 이 날수 안에 서버에서 지워질 문서는 "곧 지워짐"으로 따로 보여 준다 */
export const EXPIRING_DAYS = 7;

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

interface TripInfo {
  title: string;
  endDate?: string;
  timezone?: string;
}

function tripInfo(db: Db, tripId: string): TripInfo | null {
  const r = db
    .prepare("SELECT data_json FROM records WHERE table_name = 'trips' AND id = ?")
    .get(tripId) as { data_json: string } | undefined;
  return r ? (JSON.parse(r.data_json) as TripInfo) : null;
}

/** 여행이 끝나 EXPIRING_DAYS 안에 서버에서 지워지는가 (마지막 날 다음 날 지움) */
function expiringSoon(t: TripInfo | null, now: Date): boolean {
  if (!t?.endDate) return false;
  let today: string;
  try {
    today = todayIn(t.timezone ?? 'Asia/Seoul', now);
  } catch {
    today = todayIn('Asia/Seoul', now);
  }
  return t.endDate < addDays(today, EXPIRING_DAYS);
}

export const tripUsed = (db: Db, tripId: string): number =>
  (
    db
      .prepare('SELECT COALESCE(SUM(size), 0) AS n FROM attachments WHERE trip_id = ?')
      .get(tripId) as { n: number }
  ).n;

export const userUsed = (db: Db, userId: string): number =>
  (
    db
      .prepare('SELECT COALESCE(SUM(size), 0) AS n FROM attachments WHERE owner_user_id = ?')
      .get(userId) as { n: number }
  ).n;

export interface StorageSummary {
  used: number;
  expiring: number;
  limit: number;
  trips: {
    tripId: string;
    title: string;
    used: number;
    expiring: number;
    mine: number;
    limit: number;
  }[];
}

/**
 * 서버 저장 용량 (설정 → 백업·복원·용량): 계정 = 내가 올린 문서 합, 여행별 = 그 여행에 올라간 문서 합.
 * 곧 지워짐 = EXPIRING_DAYS 안에 끝난 여행으로 지워질 양. 파일 이름·내용은 돌려주지 않는다
 */
export function storageSummary(db: Db, userId: string, now = new Date()): StorageSummary {
  const mine = db
    .prepare(
      'SELECT trip_id, SUM(size) AS n FROM attachments WHERE owner_user_id = ? GROUP BY trip_id',
    )
    .all(userId) as { trip_id: string; n: number }[];
  const member = db
    .prepare(
      `SELECT a.trip_id, SUM(a.size) AS n FROM attachments a
       JOIN trip_members m ON m.trip_id = a.trip_id AND m.user_id = ?
       GROUP BY a.trip_id`,
    )
    .all(userId) as { trip_id: string; n: number }[];
  const ids = [...new Set([...mine.map((r) => r.trip_id), ...member.map((r) => r.trip_id)])];
  let used = 0;
  let expiring = 0;
  const trips = ids.map((tripId) => {
    const info = tripInfo(db, tripId);
    const own = mine.find((r) => r.trip_id === tripId)?.n ?? 0;
    const all = member.find((r) => r.trip_id === tripId)?.n ?? own;
    const soon = expiringSoon(info, now);
    used += own;
    if (soon) expiring += own;
    return {
      tripId,
      title: info?.title ?? '',
      used: all,
      expiring: soon ? all : 0,
      mine: own,
      limit: TRIP_QUOTA,
    };
  });
  trips.sort((a, b) => b.used - a.used);
  return { used, expiring, limit: USER_QUOTA, trips };
}
