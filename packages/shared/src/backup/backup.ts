import * as z from 'zod/mini';
import {
  BookingSchema,
  ChecklistItemSchema,
  ChecklistTemplateSchema,
  ItineraryItemSchema,
  SavedPlaceSchema,
  TripSchema,
} from '../schema/entities';

/**
 * 백업 파일 형식 (docs/06 §3). 형식이 바뀌면 BACKUP_SCHEMA_VERSION을 올리고 migrateBackup에 변환을 더한다
 * — 예전 백업은 항상 가져올 수 있어야 한다 (CLAUDE.md). 서버 동기화도 같은 스키마를 쓴다.
 */
export const BACKUP_FORMAT = 'trippocket-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export const BACKUP_TABLES = {
  trips: TripSchema,
  items: ItineraryItemSchema,
  bookings: BookingSchema,
  checklistItems: ChecklistItemSchema,
  savedPlaces: SavedPlaceSchema,
  checklistTemplates: ChecklistTemplateSchema,
} as const;
export type BackupTable = keyof typeof BACKUP_TABLES;
export const BACKUP_TABLE_NAMES = Object.keys(BACKUP_TABLES) as BackupTable[];

export interface KeyValue {
  key: string;
  value: unknown;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export type ParsedBackup =
  | {
      ok: true;
      exportedAt: string;
      data: Record<BackupTable, { id: string; updatedAt?: string; deletedAt?: unknown }[]>;
      settings: KeyValue[];
      /** 지워지지 않은 행 수 (미리보기용) */
      counts: Record<BackupTable, number>;
    }
  | { ok: false; reason: 'notJson' | 'notBackup' | 'tooNew' | 'invalid' };

/** 예전 형식 → 지금 형식 (지금은 v1뿐) */
function migrateBackup(
  schemaVersion: number,
  data: Record<string, unknown>,
): Record<string, unknown> {
  void schemaVersion;
  return data;
}

const Head = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number(),
  exportedAt: z.string(),
});
const Settings = z.array(z.object({ key: z.string(), value: z.unknown() }));

/** 파일 내용을 확인한다. 하나라도 형식이 틀리면 전체를 거부 (일부만 들어가는 일 없음) */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'notJson' };
  }
  const head = Head.safeParse(json);
  if (!head.success) return { ok: false, reason: 'notBackup' };
  if (head.data.schemaVersion > BACKUP_SCHEMA_VERSION) return { ok: false, reason: 'tooNew' };
  const rawData = (json as { data?: unknown }).data;
  const raw = migrateBackup(
    head.data.schemaVersion,
    typeof rawData === 'object' && rawData !== null ? (rawData as Record<string, unknown>) : {},
  );

  const data = {} as Extract<ParsedBackup, { ok: true }>['data'];
  const counts = {} as Record<BackupTable, number>;
  for (const t of BACKUP_TABLE_NAMES) {
    const parsed = z.array(BACKUP_TABLES[t]).safeParse(raw[t] ?? []);
    if (!parsed.success) return { ok: false, reason: 'invalid' };
    const rows = parsed.data as { id: string; updatedAt?: string; deletedAt?: unknown }[];
    data[t] = rows;
    counts[t] = rows.filter((r) => !r.deletedAt).length;
  }
  const settings = Settings.safeParse(raw.settings ?? []);
  if (!settings.success) return { ok: false, reason: 'invalid' };
  return { ok: true, exportedAt: head.data.exportedAt, data, settings: settings.data, counts };
}
