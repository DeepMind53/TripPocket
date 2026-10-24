import * as z from 'zod/mini';
import { BACKUP_TABLES, type BackupTable } from '../backup/backup';

/**
 * 동기화 프로토콜 (docs/09 §6.3). 웹·서버 공용.
 * - push: 기기에서 바뀐 행들 → 서버 (권한 확인 후 적용, 서버가 rev 부여)
 * - pull: since 이후 서버 rev 순으로 받기
 * 엔티티 형식은 백업과 같은 Zod 스키마로 검사한다
 */
export type SyncTable = BackupTable;
export const SYNC_TABLES = Object.keys(BACKUP_TABLES) as SyncTable[];
/** 여행에 딸린 표 (여행 멤버만 접근) */
export const TRIP_SCOPED: readonly SyncTable[] = ['items', 'bookings', 'checklistItems'];
/** 사람에게 딸린 표 (본인만) */
export const USER_SCOPED: readonly SyncTable[] = ['savedPlaces', 'checklistTemplates'];

export const SYNC_BATCH = 500;

export interface SyncRecord {
  id: string;
  updatedAt: string;
  deletedAt?: string | undefined;
  rev?: number | undefined;
  tripId?: string | undefined;
}

export interface PushChange {
  table: SyncTable;
  record: SyncRecord & Record<string, unknown>;
  /** 이 기기가 마지막으로 본 서버 rev (새 행이면 null) */
  baseRev: number | null;
}

const PushBody = z.object({
  changes: z
    .array(
      z.object({
        table: z.enum(SYNC_TABLES as [SyncTable, ...SyncTable[]]),
        record: z.record(z.string(), z.unknown()),
        baseRev: z.nullable(z.number()),
      }),
    )
    .check(z.maxLength(SYNC_BATCH)),
});

/** push 요청 확인. 표 이름·개수만 여기서, 각 행은 parseRecord로 따로 (행 하나가 틀려도 나머지는 적용) */
export function parsePush(
  body: unknown,
): { table: SyncTable; record: Record<string, unknown>; baseRev: number | null }[] | null {
  const r = PushBody.safeParse(body);
  return r.success ? r.data.changes : null;
}

export function parseRecord(
  table: SyncTable,
  record: unknown,
): (SyncRecord & Record<string, unknown>) | null {
  const r = BACKUP_TABLES[table].safeParse(record);
  return r.success ? (r.data as SyncRecord & Record<string, unknown>) : null;
}

export interface PushResult {
  applied: { table: SyncTable; id: string; rev: number }[];
  rejected: { table: SyncTable; id: string; reason: 'invalid' | 'forbidden' }[];
}

export type TripRole = 'owner' | 'editor' | 'viewer';

export interface PullResult {
  changes: { table: SyncTable; record: SyncRecord & Record<string, unknown>; rev: number }[];
  nextRev: number;
  hasMore: boolean;
  /** 내가 멤버인 여행마다 내 역할 (보기 전용이면 앱이 수정을 막는다). 예전 서버는 없음 */
  roles?: Record<string, TripRole>;
}
